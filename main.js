const { app, BrowserWindow, dialog, ipcMain, Menu, protocol } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

protocol.registerSchemesAsPrivileged([{
  scheme: 'isaac-asset',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
}]);

const CLOSED_WINDOW_SIZE = { width: 268, height: 322 };
const RIGHT_OPEN_WINDOW_SIZE = { width: 688, height: 322 };
const LEFT_OPEN_WINDOW_SIZE = { width: 688, height: 322 };
const SIDE_PANEL_WIDTHS = { left: 420, right: 420 };
const FIXED_WINDOW_SIZE = {
  width: SIDE_PANEL_WIDTHS.left + CLOSED_WINDOW_SIZE.width + SIDE_PANEL_WIDTHS.right,
  height: CLOSED_WINDOW_SIZE.height
};
const PLAYER_ANM2 = 'gfx/001.000_player.anm2';
const APPEARANCE_SLOTS_FILE = 'appearance-slots.json';
const APPEARANCE_SLOTS_VERSION = 1;
const ASSET_MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};
const PROGRAM_ROOT = app.isPackaged ? path.dirname(process.execPath) : __dirname;
const PORTABLE_DATA_ROOT = path.join(PROGRAM_ROOT, 'data');
const PORTABLE_PATHS = {
  userData: path.join(PORTABLE_DATA_ROOT, 'config'),
  sessionData: path.join(PORTABLE_DATA_ROOT, 'cache'),
  logs: path.join(PORTABLE_DATA_ROOT, 'logs'),
  crashDumps: path.join(PORTABLE_DATA_ROOT, 'crash-dumps')
};
const legacyUserDataPath = app.getPath('userData');

let windowRef;
let assetRoot;
let windowPosition;
let portableSetupError;

try {
  for (const directory of Object.values(PORTABLE_PATHS)) {
    fs.mkdirSync(directory, { recursive: true });
  }
  for (const [name, directory] of Object.entries(PORTABLE_PATHS)) {
    app.setPath(name, directory);
  }
} catch (error) {
  portableSetupError = error;
}

function emptyAppearanceSlots() {
  return { version: APPEARANCE_SLOTS_VERSION, characters: {} };
}

function isValidCharacterName(characterName) {
  return typeof characterName === 'string'
    && /^[A-Za-z ]{1,40}$/.test(characterName)
    && !['constructor', 'prototype'].includes(characterName.toLowerCase());
}

function normalizeAppearanceSlot(slot) {
  if (!slot || typeof slot !== 'object' || Array.isArray(slot)) return null;
  const itemIds = Array.isArray(slot.itemIds)
    ? [...new Set(slot.itemIds.filter(id => typeof id === 'string' && /^item-\d+$/.test(id)))].slice(0, 500)
    : [];
  const appearanceSelections = {};
  if (slot.appearanceSelections && typeof slot.appearanceSelections === 'object') {
    for (const [key, value] of Object.entries(slot.appearanceSelections)) {
      if (!/^[a-z0-9-]{1,64}$/i.test(key)) continue;
      if (Number.isFinite(value)) {
        appearanceSelections[key] = value;
      } else if (Array.isArray(value)) {
        appearanceSelections[key] = [...new Set(value.filter(Number.isFinite))].slice(0, 100);
      }
    }
  }
  return {
    itemIds,
    appearanceSelections,
    savedAt: typeof slot.savedAt === 'string' ? slot.savedAt : null
  };
}

function normalizeAppearanceSlots(data) {
  const normalized = emptyAppearanceSlots();
  if (!data || typeof data !== 'object' || !data.characters || typeof data.characters !== 'object') {
    return normalized;
  }
  for (const [characterName, slots] of Object.entries(data.characters)) {
    if (!isValidCharacterName(characterName) || !slots || typeof slots !== 'object') continue;
    const normalizedSlots = {};
    for (const slotIndex of ['1', '2', '3']) {
      const slot = normalizeAppearanceSlot(slots[slotIndex]);
      if (slot) normalizedSlots[slotIndex] = slot;
    }
    if (Object.keys(normalizedSlots).length) normalized.characters[characterName] = normalizedSlots;
  }
  return normalized;
}

function appearanceSlotsPath() {
  return path.join(app.getPath('userData'), APPEARANCE_SLOTS_FILE);
}

function migrateLegacyAppearanceSlots() {
  const sourcePath = path.join(legacyUserDataPath, APPEARANCE_SLOTS_FILE);
  const targetPath = appearanceSlotsPath();
  if (sourcePath === targetPath || fs.existsSync(targetPath) || !fs.existsSync(sourcePath)) return;
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath, fs.constants.COPYFILE_EXCL);
}

function readAppearanceSlots() {
  const filePath = appearanceSlotsPath();
  if (!fs.existsSync(filePath)) return emptyAppearanceSlots();
  try {
    return normalizeAppearanceSlots(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch (error) {
    console.warn(`读取外观槽位失败：${error.message}`);
    return emptyAppearanceSlots();
  }
}

function saveAppearanceSlot(characterName, slotIndex, configuration) {
  if (!isValidCharacterName(characterName)) throw new Error('角色名称无效。');
  if (!Number.isInteger(slotIndex) || slotIndex < 1 || slotIndex > 3) throw new Error('外观槽位无效。');
  const slot = normalizeAppearanceSlot(configuration);
  if (!slot) throw new Error('外观配置无效。');
  slot.savedAt = new Date().toISOString();

  const data = readAppearanceSlots();
  if (!Object.hasOwn(data.characters, characterName)) data.characters[characterName] = {};
  data.characters[characterName][slotIndex] = slot;
  fs.mkdirSync(path.dirname(appearanceSlotsPath()), { recursive: true });
  fs.writeFileSync(appearanceSlotsPath(), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return data;
}

function candidateAssetRoots() {
  return [
    path.join(PROGRAM_ROOT, 'assets', 'isaac'),
    process.env.ISAAC_ASSET_ROOT,
    path.resolve(__dirname, '..', '以撒资源素材', 'extracted_resources', 'resources'),
    path.resolve(process.cwd(), '..', '以撒资源素材', 'extracted_resources', 'resources'),
    path.join(app.getPath('userData'), 'resources')
  ].filter(Boolean);
}

function resolveAssetRoot() {
  const found = candidateAssetRoots().find(candidate => fs.existsSync(path.join(candidate, 'gfx')));
  if (!found) {
    throw new Error('找不到资源目录。请设置 ISAAC_ASSET_ROOT，或将提取出的 resources 放在项目同级的“以撒资源素材”目录中。');
  }
  return path.resolve(found);
}

function safeAssetPath(relativePath) {
  if (typeof relativePath !== 'string' || !relativePath.trim()) throw new Error('资源路径为空。');
  const normalized = relativePath.replaceAll('\\', '/').replace(/^\/+/, '');
  const resolved = path.resolve(assetRoot, normalized);
  const rootWithSep = `${assetRoot}${path.sep}`;
  if (resolved !== assetRoot && !resolved.startsWith(rootWithSep)) throw new Error('资源路径越界。');
  if (fs.existsSync(resolved)) return resolved;

  // Extracted game resources mix upper- and lower-case path segments.
  let current = assetRoot;
  for (const segment of normalized.split('/')) {
    const match = fs.readdirSync(current, { withFileTypes: true })
      .find(entry => entry.name.toLowerCase() === segment.toLowerCase());
    if (!match) return resolved;
    current = path.join(current, match.name);
  }
  return current;
}

function assetResponse(relativePath) {
  const filePath = safeAssetPath(relativePath);
  if (!fs.existsSync(filePath)) throw new Error(`找不到资源：${relativePath}`);
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.anm2' || extension === '.xml' || extension === '.json') {
    return { type: 'text', path: relativePath, value: fs.readFileSync(filePath, 'utf8') };
  }
  const mime = ASSET_MIME_TYPES[extension];
  if (!mime) throw new Error(`暂不支持的资源类型：${extension}`);
  return { type: 'data-url', path: relativePath, value: `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}` };
}

function registerAssetProtocol() {
  protocol.handle('isaac-asset', request => {
    try {
      const requestUrl = new URL(request.url);
      if (requestUrl.hostname !== 'local') return new Response('Invalid asset host', { status: 403 });
      const relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '');
      const filePath = safeAssetPath(relativePath);
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        return new Response('Asset not found', { status: 404 });
      }
      const mime = ASSET_MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      return new Response(fs.readFileSync(filePath), {
        status: 200,
        headers: { 'content-type': mime, 'cache-control': 'no-cache' }
      });
    } catch (error) {
      return new Response(error.message, { status: 400 });
    }
  });
}

function createWindow() {
  windowRef = new BrowserWindow({
    width: FIXED_WINDOW_SIZE.width,
    height: FIXED_WINDOW_SIZE.height,
    minWidth: FIXED_WINDOW_SIZE.width,
    maxWidth: FIXED_WINDOW_SIZE.width,
    minHeight: FIXED_WINDOW_SIZE.height,
    maxHeight: FIXED_WINDOW_SIZE.height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  windowRef.setAlwaysOnTop(true, 'floating');
  windowRef.setShape([{
    x: SIDE_PANEL_WIDTHS.left,
    y: 0,
    width: CLOSED_WINDOW_SIZE.width,
    height: CLOSED_WINDOW_SIZE.height
  }]);
  const initialBounds = windowRef.getBounds();
  windowPosition = { x: initialBounds.x, y: initialBounds.y };
  windowRef.loadFile(path.join(__dirname, 'index.html'));
  windowRef.on('closed', () => { windowRef = undefined; });
}

function moveWindow(x, y) {
  if (!windowRef || windowRef.isDestroyed() || !Number.isFinite(x) || !Number.isFinite(y)) return;
  windowPosition = { x, y };
  windowRef.setBounds({
    x: Math.round(x),
    y: Math.round(y),
    width: FIXED_WINDOW_SIZE.width,
    height: FIXED_WINDOW_SIZE.height
  }, false);
}

function nudgeWindow(deltaX, deltaY) {
  if (!windowRef || windowRef.isDestroyed()) return;
  if (!windowPosition) {
    const bounds = windowRef.getBounds();
    windowPosition = { x: bounds.x, y: bounds.y };
  }
  // Keep subpixel movement between frames; getBounds() only exposes integer pixels.
  windowPosition.x += deltaX;
  windowPosition.y += deltaY;
  windowRef.setBounds({
    x: Math.round(windowPosition.x),
    y: Math.round(windowPosition.y),
    width: FIXED_WINDOW_SIZE.width,
    height: FIXED_WINDOW_SIZE.height
  }, false);
}

function setSidePanel(side) {
  if (!windowRef || windowRef.isDestroyed()) return;
  const nextSide = ['left', 'right', 'both'].includes(side) ? side : null;
  const shape = nextSide === 'both'
    ? { x: 0, y: 0, ...FIXED_WINDOW_SIZE }
    : nextSide === 'left'
      ? { x: 0, y: 0, ...LEFT_OPEN_WINDOW_SIZE }
      : nextSide === 'right'
        ? { x: SIDE_PANEL_WIDTHS.left, y: 0, ...RIGHT_OPEN_WINDOW_SIZE }
        : {
            x: SIDE_PANEL_WIDTHS.left,
            y: 0,
            width: CLOSED_WINDOW_SIZE.width,
            height: CLOSED_WINDOW_SIZE.height
          };
  windowRef.setShape([shape]);
  return windowRef.getBounds();
}

app.whenReady().then(() => {
  if (portableSetupError) {
    dialog.showErrorBox(
      '以撒暖暖无法启动',
      `程序目录不可写，无法创建便携数据目录：\n${PORTABLE_DATA_ROOT}\n\n${portableSetupError.message}`
    );
    app.quit();
    return;
  }

  try {
    migrateLegacyAppearanceSlots();
    assetRoot = resolveAssetRoot();
    registerAssetProtocol();
  } catch (error) {
    dialog.showErrorBox('以撒暖暖无法启动', error.message);
    app.quit();
    return;
  }

  ipcMain.handle('asset-read', (_event, relativePath) => assetResponse(relativePath));
  ipcMain.handle('asset-root', () => assetRoot);
  ipcMain.handle('player-entry', () => ({ animation: PLAYER_ANM2, root: assetRoot }));
  ipcMain.handle('window-bounds', () => windowRef.getBounds());
  ipcMain.on('window-move', (_event, x, y) => moveWindow(x, y));
  ipcMain.on('window-nudge', (_event, deltaX, deltaY) => {
    if (Number.isFinite(deltaX) && Number.isFinite(deltaY)) nudgeWindow(deltaX, deltaY);
  });
  ipcMain.on('side-panel-set', (event, side) => {
    event.returnValue = setSidePanel(side);
  });
  ipcMain.handle('appearance-slots-load', () => readAppearanceSlots());
  ipcMain.handle('appearance-slot-save', (_event, characterName, slotIndex, configuration) => (
    saveAppearanceSlot(characterName, slotIndex, configuration)
  ));
  ipcMain.on('window-menu', () => {
    Menu.buildFromTemplate([
      { label: `资源目录：${assetRoot}`, enabled: false },
      { label: `配置目录：${app.getPath('userData')}`, enabled: false },
      { label: `缓存目录：${app.getPath('sessionData')}`, enabled: false },
      { type: 'separator' },
      { label: '退出', role: 'quit' }
    ]).popup({ window: windowRef });
  });
  createWindow();
});

app.on('window-all-closed', () => app.quit());
