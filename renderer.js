const canvas = document.getElementById('character-canvas');
const context = canvas.getContext('2d');
const dragHandle = document.querySelector('.drag-handle');
const desktopPet = document.querySelector('.desktop-pet');
const hairMenuToggle = document.querySelector('.hair-menu-toggle');
const hairPanel = document.querySelector('.hair-panel');
const hairResults = document.querySelector('.hair-results');
const itemMenuToggle = document.querySelector('.item-menu-toggle');
const appearanceSlotButtons = Array.from(document.querySelectorAll('.appearance-slot-button'));
const itemPanel = document.querySelector('.item-panel');
const itemSearch = document.querySelector('.item-search');
const itemCategoryFilter = document.querySelector('.item-category-filter');
const itemEquipmentFilter = document.querySelector('.item-equipment-filter');
const itemResults = document.querySelector('.item-results');
const itemEmpty = document.querySelector('.item-empty');
const characterVariantToggle = document.querySelector('.character-variant-toggle');
const characterVariantIcon = characterVariantToggle.querySelector('img');

context.imageSmoothingEnabled = false;

const initialAnimationTime = performance.now();

function browserAssetUrl(relativePath) {
  const normalized = relativePath
    .replace(/^assets\/isaac\//i, '')
    .replaceAll('\\', '/')
    .replace(/^\/+/, '');
  return `isaac-asset://local/${normalized.split('/').map(encodeURIComponent).join('/')}`;
}

const state = {
  actor: null,
  animation: null,
  overlays: [],
  appearanceOverlays: [],
  itemOverlays: [],
  images: new Map(),
  actorDefinitions: new Map(),
  tick: 0,
  lastTime: initialAnimationTime,
  lastRenderTime: initialAnimationTime,
  lastMovementTime: initialAnimationTime,
  appearanceStartTime: initialAnimationTime,
  dragging: null,
  heldKeys: new Set(),
  characterIndex: 0,
  characterVariants: new Map(),
  characterSheet: null,
  baseSkinTransform: null,
  appearanceSelections: new Map(),
  equippedItemsByCharacter: new Map(),
  appearanceSlots: {},
  appearanceSlotBusy: false,
  characterVariantTransitioning: false,
  hiddenBaseLayers: new Set(),
  hairMenuOpen: false,
  hairMenuTransitioning: false,
  itemMenuOpen: false,
  itemMenuTransitioning: false,
  itemCategoryIndex: 0,
  itemEquipmentFilterIndex: 0,
  phase: 'idle',
  direction: 'Down'
};

// These base sheets share the 512x512 layout used by the generic player ANM2.
const characterCatalog = [
  { name: 'Isaac', sprite: 'character_001_isaac.png', skinVariants: true, skinColor: -1 },
  { name: 'Magdalene', sprite: 'character_002_magdalene.png', skinVariants: true, skinColor: -1, overlays: ['character_002_magdalenehead.anm2'] },
  { name: 'Cain', sprite: 'character_003_cain.png', skinVariants: true, skinColor: -1, overlays: ['character_003_cainseyepatch.anm2'] },
  {
    name: 'Judas',
    sprite: 'character_004_judas.png',
    skinVariants: true,
    skinColor: -1,
    overlays: ['character_004_judasfez.anm2'],
    variants: [{
      name: 'Dark Judas',
      sprite: 'character_013_blackjudas.png',
      skinColor: 1,
      costumeSuffix: 'shadow',
      portrait: 'gfx/ui/stage/playerportrait_darkjudas.png'
    }]
  },
  { name: 'Eve', sprite: 'character_005_eve.png', skinVariants: true, skinColor: -1, overlays: ['character_005_evehead.anm2'] },
  { name: 'Blue Baby', sprite: 'character_006_bluebaby.png', skinColor: 2, costumeSuffix: 'bluebaby' },
  { name: 'Samson', sprite: 'character_007_samson.png', skinVariants: true, skinColor: -1, overlays: ['character_007_samsonhead.anm2'] },
  { name: 'Azazel', sprite: 'character_008_azazel.png', skinColor: 1, flying: true },
  {
    name: 'Lazarus',
    sprite: 'character_009_lazarus.png',
    skinVariants: true,
    skinColor: -1,
    overlays: ['character_lazarushair1.anm2'],
    variants: [{
      name: 'Lazarus Risen',
      sprite: 'character_010_lazarus2.png',
      skinVariants: true,
      skinColor: -1,
      overlays: ['character_lazarushair2.anm2'],
      portrait: 'gfx/ui/stage/playerportrait_lazarus2.png'
    }]
  },
  {
    name: 'Eden',
    sprite: 'character_009_eden.png',
    skinVariants: true,
    skinColor: -1,
    overlays: [{
      animation: 'character_009_edenhair1.anm2',
      option: {
        id: 'eden-hair',
        label: '发型',
        min: 1,
        max: 54,
        multiple: true,
        sprite: value => `character_009_edenhair${value}.png`
      }
    }]
  },
  { name: 'The Lost', sprite: 'character_012_thelost.png', skinColor: 0, flying: true },
  { name: 'Lilith', sprite: 'character_014_lilith.png', skinColor: 1, costumeSuffix: 'lilith', overlays: ['character_lilithhair.anm2'] },
  { name: 'Keeper', sprite: 'character_015_keeper.png', skinColor: 5, costumeSuffix: 'keeper', overlays: ['character_014_keepernoose.anm2'] },
  {
    name: 'Apollyon',
    sprite: 'character_016_apollyon.png',
    skinColor: 5,
    costumeSuffix: 'apollyon',
    hideBaseLayers: ['body'],
    overlays: [{
      animation: 'character_015_apollyonbody.anm2',
      tracks: [
        { source: 'movement', layers: ['body'], placement: 'beforeBase', inheritsSkinColor: true },
        { source: 'head', layers: ['head0'] }
      ]
    }]
  },
  {
    name: 'The Forgotten',
    sprite: 'character_017_theforgotten.png',
    skinColor: 5,
    costumeSuffix: 'forgotten',
    hideBaseLayers: ['body'],
    overlays: [{
      animation: 'character_016_theforgottenbody.anm2',
      tracks: [
        { source: 'movement', layers: ['body'], placement: 'beforeBase', inheritsSkinColor: true }
      ]
    }],
    variants: [{
      name: 'The Soul',
      sprite: 'character_018_thesoul.png',
      skinColor: 2,
      costumeSuffix: 'forgottensoul',
      flying: true,
      portrait: 'gfx/ui/stage/playerportrait_theforgotten.png'
    }]
  },
  { name: 'Bethany', sprite: 'character_001x_bethany.png', skinVariants: true, skinColor: -1, overlays: ['character_001x_bethanyhead.anm2'] },
  { name: 'Jacob', sprite: 'character_002x_jacob.png', skinVariants: true, skinColor: -1, overlays: ['character_002x_jacobhead.anm2'] },
  { name: 'Esau', sprite: 'character_003x_esau.png', skinVariants: true, skinColor: 3, overlays: ['character_003x_esauhead.anm2'] }
];

const skinColorSuffixes = ['white', 'black', 'blue', 'red', 'green', 'grey'];

function baseCharacter(index = state.characterIndex) {
  return characterCatalog[index];
}

function activeCharacter(index = state.characterIndex) {
  const base = baseCharacter(index);
  const variantName = state.characterVariants.get(base.name);
  return base.variants?.find(variant => variant.name === variantName) || base;
}

function characterByName(characterName) {
  for (const character of characterCatalog) {
    if (character.name === characterName) return character;
    const variant = character.variants?.find(entry => entry.name === characterName);
    if (variant) return variant;
  }
  return null;
}
const skinColorPalettes = new Map([
  [-1, [[227, 198, 197], [207, 156, 155], [185, 115, 113]]],
  [0, [[255, 255, 255], [226, 226, 226], [194, 194, 194]]],
  [1, [[46, 46, 46], [35, 35, 35], [24, 24, 24]]],
  [2, [[86, 108, 138], [64, 80, 102], [44, 55, 71]]],
  [3, [[153, 36, 36], [121, 32, 32], [87, 23, 23]]],
  [4, [[203, 239, 191], [159, 207, 143], [123, 164, 103]]],
  [5, [[167, 167, 167], [120, 120, 120], [84, 84, 84]]]
]);

let itemCatalog = [];

const itemCategories = [
  { id: 'all', shortLabel: '全', label: '全部部件' },
  { id: 'head', shortLabel: '头', label: '头部' },
  { id: 'body', shortLabel: '身', label: '身体' },
  { id: 'other', shortLabel: '饰', label: '其他装饰' }
];

const itemEquipmentFilters = [
  { id: 'all', shortLabel: '全', label: '全部道具' },
  { id: 'equipped', shortLabel: '装', label: '仅显示已装备' },
  { id: 'unequipped', shortLabel: '未', label: '排除已装备' }
];

const directionKeys = {
  ArrowLeft: 'Left',
  Left: 'Left',
  KeyA: 'Left',
  a: 'Left',
  A: 'Left',
  ArrowRight: 'Right',
  Right: 'Right',
  KeyD: 'Right',
  d: 'Right',
  D: 'Right',
  ArrowUp: 'Up',
  Up: 'Up',
  KeyW: 'Up',
  w: 'Up',
  W: 'Up',
  ArrowDown: 'Down',
  Down: 'Down',
  KeyS: 'Down',
  s: 'Down',
  S: 'Down'
};

function keyNames(event) {
  return [event.key, event.code].filter(Boolean);
}

function directionForEvent(event) {
  return keyNames(event).map(key => directionKeys[key]).find(Boolean);
}

function isDirectionHeld(direction) {
  for (const key of state.heldKeys) {
    if (directionKeys[key] === direction) return true;
  }
  return false;
}

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  return String(value).toLowerCase() === 'true';
};

function elements(parent, name) {
  return Array.from(parent?.children ?? []).filter(element => element.tagName === name);
}

function normalizeResourcePath(actorPath, referencedPath) {
  const clean = String(referencedPath || '').replaceAll('\\', '/').replace(/^\/+/, '');
  if (clean.toLowerCase().startsWith('gfx/')) return clean;
  const base = actorPath.slice(0, actorPath.lastIndexOf('/') + 1).split('/');
  const segments = [...base, ...clean.split('/')];
  const normalized = [];
  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') normalized.pop();
    else normalized.push(segment);
  }
  return normalized.join('/');
}

function expandFrames(frameElements) {
  const frames = [];
  for (const element of frameElements) {
    const delay = Math.max(1, Math.round(toNumber(element.getAttribute('Delay'), 1)));
    for (let index = 0; index < delay; index += 1) frames.push(element);
  }
  return frames;
}

function parseFrame(element) {
  if (!element) return null;
  return {
    x: toNumber(element.getAttribute('XPosition')),
    y: toNumber(element.getAttribute('YPosition')),
    pivotX: toNumber(element.getAttribute('XPivot')),
    pivotY: toNumber(element.getAttribute('YPivot')),
    cropX: toNumber(element.getAttribute('XCrop')),
    cropY: toNumber(element.getAttribute('YCrop')),
    width: toNumber(element.getAttribute('Width')),
    height: toNumber(element.getAttribute('Height')),
    scaleX: toNumber(element.getAttribute('XScale'), 100) / 100,
    scaleY: toNumber(element.getAttribute('YScale'), 100) / 100,
    rotation: toNumber(element.getAttribute('Rotation')) * Math.PI / 180,
    alpha: toNumber(element.getAttribute('AlphaTint'), 255) / 255,
    red: toNumber(element.getAttribute('RedTint'), 255) / 255,
    green: toNumber(element.getAttribute('GreenTint'), 255) / 255,
    blue: toNumber(element.getAttribute('BlueTint'), 255) / 255,
    visible: toBoolean(element.getAttribute('Visible'), true)
  };
}

function parseAnm2(xmlText, actorPath) {
  const documentNode = new DOMParser().parseFromString(xmlText, 'application/xml');
  const parserError = documentNode.querySelector('parsererror');
  if (parserError) throw new Error(`ANM2 解析失败：${parserError.textContent}`);
  const root = documentNode.querySelector('AnimatedActor');
  if (!root) throw new Error('ANM2 缺少 AnimatedActor 节点。');

  const spriteSheets = new Map(elements(root.querySelector('Spritesheets'), 'Spritesheet').map(node => [
    node.getAttribute('Id'), normalizeResourcePath(actorPath, node.getAttribute('Path'))
  ]));
  const layerNodes = elements(root.querySelector('Layers'), 'Layer');
  const layers = layerNodes.map(node => ({
    id: node.getAttribute('Id'),
    name: node.getAttribute('Name') || `layer-${node.getAttribute('Id')}`,
    spriteSheet: spriteSheets.get(node.getAttribute('SpritesheetId'))
  }));
  const animationRoot = root.querySelector('Animations');
  const animations = elements(animationRoot, 'Animation').map(animationNode => {
    const layerAnimations = new Map();
    for (const layerNode of elements(animationNode.querySelector('LayerAnimations'), 'LayerAnimation')) {
      layerAnimations.set(layerNode.getAttribute('LayerId'), expandFrames(elements(layerNode, 'Frame')));
    }
    const rootFrames = expandFrames(elements(animationNode.querySelector('RootAnimation'), 'Frame'));
    return {
      name: animationNode.getAttribute('Name'),
      frameCount: Math.max(1, Math.round(toNumber(animationNode.getAttribute('FrameNum'), rootFrames.length || 1))),
      loop: toBoolean(animationNode.getAttribute('Loop')),
      rootFrames,
      layerAnimations
    };
  });

  return {
    fps: Math.max(1, toNumber(root.querySelector('Info')?.getAttribute('Fps'), 30)),
    defaultAnimation: animationRoot?.getAttribute('DefaultAnimation') || animations[0]?.name,
    layers,
    animations
  };
}

async function loadImage(resourcePath) {
  if (state.images.has(resourcePath)) return state.images.get(resourcePath);
  const resource = await window.isaac.readAsset(resourcePath);
  const image = new Image();
  image.src = resource.value;
  await image.decode();
  state.images.set(resourcePath, image);
  return image;
}

async function loadSkinTransformedImage(resourcePath, sourceColor, targetColor) {
  if (sourceColor === targetColor) return loadImage(resourcePath);
  const sourcePalette = skinColorPalettes.get(sourceColor);
  const targetPalette = skinColorPalettes.get(targetColor);
  if (!sourcePalette || !targetPalette) return loadImage(resourcePath);
  const cacheKey = `${resourcePath}#skin:${sourceColor}:${targetColor}`;
  if (state.images.has(cacheKey)) return state.images.get(cacheKey);

  const sourceImage = await loadImage(resourcePath);
  const buffer = document.createElement('canvas');
  buffer.width = sourceImage.naturalWidth;
  buffer.height = sourceImage.naturalHeight;
  const bufferContext = buffer.getContext('2d', { willReadFrequently: true });
  bufferContext.imageSmoothingEnabled = false;
  bufferContext.drawImage(sourceImage, 0, 0);
  const imageData = bufferContext.getImageData(0, 0, buffer.width, buffer.height);
  for (let offset = 0; offset < imageData.data.length; offset += 4) {
    if (imageData.data[offset + 3] === 0) continue;
    const paletteIndex = sourcePalette.findIndex(color => (
      imageData.data[offset] === color[0]
      && imageData.data[offset + 1] === color[1]
      && imageData.data[offset + 2] === color[2]
    ));
    if (paletteIndex < 0) continue;
    const replacement = targetPalette[paletteIndex];
    imageData.data[offset] = replacement[0];
    imageData.data[offset + 1] = replacement[1];
    imageData.data[offset + 2] = replacement[2];
  }
  bufferContext.putImageData(imageData, 0, 0);

  const image = new Image();
  image.src = buffer.toDataURL('image/png');
  await image.decode();
  state.images.set(cacheKey, image);
  return image;
}

async function loadActorDefinition(animationPath) {
  if (!state.actorDefinitions.has(animationPath)) {
    state.actorDefinitions.set(animationPath, window.isaac.readAsset(animationPath)
      .then(resource => parseAnm2(resource.value, animationPath)));
  }
  const template = await state.actorDefinitions.get(animationPath);
  return {
    ...template,
    layers: template.layers.map(layer => ({ ...layer }))
  };
}

function normalizeAppearanceValues(option, selection) {
  const values = Array.isArray(selection) ? selection : [selection];
  return [...new Set(values
    .map(value => Math.round(Number(value)))
    .filter(Number.isFinite)
    .map(value => Math.min(option.max, Math.max(option.min, value))))]
    .sort((left, right) => left - right);
}

function appearanceValues(option) {
  if (!state.appearanceSelections.has(option.id)) {
    state.appearanceSelections.set(option.id, [option.defaultValue ?? option.min]);
  }
  const values = normalizeAppearanceValues(option, state.appearanceSelections.get(option.id));
  state.appearanceSelections.set(option.id, values);
  return values;
}

function applyAppearanceOption(overlay, value) {
  const option = overlay.option;
  if (!option) return;
  const numericValue = Math.min(option.max, Math.max(option.min, Math.round(Number(value))));
  if (!Number.isFinite(numericValue)) return;
  overlay.optionValue = numericValue;
  const spriteSheet = `gfx/characters/costumes/${option.sprite(numericValue)}`;
  for (const layer of overlay.actor.layers) layer.spriteSheet = spriteSheet;
}

async function loadOverlayDefinition(definition, costumeSuffix = null, skinColor = null) {
  const descriptor = typeof definition === 'string' ? { animation: definition } : definition;
  const animationPath = `gfx/characters/${descriptor.animation}`;
  const actor = await loadActorDefinition(animationPath);
  const colorAlternates = descriptor.skinColorAlternates?.[skinColor] || null;
  const characterAlternates = costumeSuffix ? descriptor.skinAlternates?.[costumeSuffix] : null;
  const characterColorAlternates = costumeSuffix
    ? descriptor.characterSkinColorAlternates?.[costumeSuffix]?.[skinColor] || null
    : null;
  if (colorAlternates || characterAlternates || characterColorAlternates) {
    for (const layer of actor.layers) {
      const sourcePath = layer.spriteSheet.toLowerCase();
      layer.spriteSheet = characterColorAlternates?.[sourcePath]
        || characterAlternates?.[sourcePath]
        || colorAlternates?.[sourcePath]
        || layer.spriteSheet;
    }
  }
  const overlay = {
    actor,
    animationPath,
    option: descriptor.option || null,
    renderOrder: Number(descriptor.renderOrder) || 0,
    tracks: (descriptor.tracks || [{ source: 'head' }]).map(track => ({
      source: track.source || 'head',
      placement: track.placement || 'afterBase',
      inheritsSkinColor: Boolean(track.inheritsSkinColor),
      animateWhileFlying: Boolean(track.animateWhileFlying || descriptor.grantsFlight),
      layers: track.layers ? new Set(track.layers.map(name => name.toLowerCase())) : null,
      offsetX: toNumber(track.offsetX),
      offsetY: toNumber(track.offsetY),
      animation: null
    }))
  };
  return overlay;
}

async function loadAppearanceOverlays(character) {
  const overlayPromises = [];
  for (const definition of character.overlays || []) {
    const descriptor = typeof definition === 'string' ? { animation: definition } : definition;
    if (descriptor.option?.multiple) {
      for (const value of appearanceValues(descriptor.option)) {
        overlayPromises.push(loadOverlayDefinition(descriptor).then(overlay => {
          applyAppearanceOption(overlay, value);
          return overlay;
        }));
      }
    } else {
      overlayPromises.push(loadOverlayDefinition(descriptor).then(overlay => {
        if (overlay.option) applyAppearanceOption(overlay, appearanceValues(overlay.option)[0]);
        return overlay;
      }));
    }
  }
  return Promise.all(overlayPromises);
}

function equippedItemIds(characterName = activeCharacter().name) {
  if (!state.equippedItemsByCharacter.has(characterName)) {
    state.equippedItemsByCharacter.set(characterName, new Set());
  }
  return state.equippedItemsByCharacter.get(characterName);
}

function equippedItems(characterName = activeCharacter().name) {
  const equipped = equippedItemIds(characterName);
  return itemCatalog
    .filter(item => equipped.has(item.id))
    .sort((left, right) => left.priority - right.priority);
}

function characterCanFly(character = activeCharacter()) {
  return Boolean(
    character.flying
    || equippedItems(character.name).some(item => item.grantsFlight)
  );
}

function activeColorOverride(characterName = activeCharacter().name) {
  return equippedItems(characterName)
    .filter(item => item.overwriteColor && skinColorPalettes.has(item.skinColor))
    .at(-1) || null;
}

function appearanceOptions(character) {
  return (character.overlays || [])
    .filter(definition => typeof definition === 'object' && definition.option)
    .map(definition => definition.option);
}

function currentAppearanceConfiguration(character) {
  const validItemIds = new Set(itemCatalog.map(item => item.id));
  const itemIds = [...equippedItemIds(character.name)]
    .filter(itemId => validItemIds.has(itemId))
    .sort((left, right) => Number(left.slice(5)) - Number(right.slice(5)));
  const appearanceSelections = {};
  for (const option of appearanceOptions(character)) {
    appearanceSelections[option.id] = appearanceValues(option);
  }
  return { itemIds, appearanceSelections };
}

function updateAppearanceSlotButtons() {
  const character = activeCharacter();
  const slots = state.appearanceSlots[character.name] || {};
  for (const button of appearanceSlotButtons) {
    const slotIndex = button.dataset.slot;
    const filled = Boolean(slots[slotIndex]);
    button.classList.toggle('is-filled', filled);
    button.classList.remove('is-error');
    button.title = filled
      ? `加载${character.name}的配置槽位 ${slotIndex}（Shift+点击覆盖）`
      : `保存${character.name}到配置槽位 ${slotIndex}`;
    button.setAttribute('aria-label', button.title);
  }
}

async function saveCurrentAppearanceSlot(slotIndex, button) {
  if (state.appearanceSlotBusy
    || hairResults.getAttribute('aria-busy') === 'true'
    || itemResults.getAttribute('aria-busy') === 'true'
    || !Number.isInteger(slotIndex)
    || slotIndex < 1
    || slotIndex > 3) return;
  const character = activeCharacter();
  state.appearanceSlotBusy = true;
  appearanceSlotButtons.forEach(slotButton => { slotButton.disabled = true; });
  button.classList.remove('is-error', 'is-saved');

  try {
    const data = await window.isaac.saveAppearanceSlot(
      character.name,
      slotIndex,
      currentAppearanceConfiguration(character)
    );
    state.appearanceSlots = data.characters || {};
    updateAppearanceSlotButtons();
    button.classList.remove('is-saved');
    void button.offsetWidth;
    button.classList.add('is-saved');
    setTimeout(() => button.classList.remove('is-saved'), 420);
  } catch (error) {
    button.classList.add('is-error');
    console.error(`配置槽位 ${slotIndex} 保存失败：`, error);
  } finally {
    state.appearanceSlotBusy = false;
    appearanceSlotButtons.forEach(slotButton => { slotButton.disabled = false; });
  }
}

async function loadAppearanceSlot(slotIndex, button) {
  if (state.appearanceSlotBusy
    || hairResults.getAttribute('aria-busy') === 'true'
    || itemResults.getAttribute('aria-busy') === 'true'
    || !Number.isInteger(slotIndex)
    || slotIndex < 1
    || slotIndex > 3) return;
  const character = activeCharacter();
  const slot = state.appearanceSlots[character.name]?.[String(slotIndex)];
  if (!slot) return;

  const previousItemIds = new Set(equippedItemIds(character.name));
  const previousSelections = new Map();
  for (const option of appearanceOptions(character)) {
    previousSelections.set(option.id, state.appearanceSelections.has(option.id)
      ? [...state.appearanceSelections.get(option.id)]
      : null);
  }
  const previousAppearanceOverlays = state.appearanceOverlays;
  const previousItemOverlays = state.itemOverlays;
  const validItemIds = new Set(itemCatalog.map(item => item.id));

  state.appearanceSlotBusy = true;
  appearanceSlotButtons.forEach(slotButton => { slotButton.disabled = true; });
  hairResults.setAttribute('aria-busy', 'true');
  itemResults.setAttribute('aria-busy', 'true');
  button.classList.remove('is-error', 'is-saved');

  try {
    state.equippedItemsByCharacter.set(character.name, new Set(
      slot.itemIds.filter(itemId => validItemIds.has(itemId))
    ));
    for (const option of appearanceOptions(character)) {
      const savedSelection = Object.hasOwn(slot.appearanceSelections, option.id)
        ? slot.appearanceSelections[option.id]
        : [option.defaultValue ?? option.min];
      const values = normalizeAppearanceValues(option, savedSelection);
      state.appearanceSelections.set(option.id, option.multiple || values.length
        ? values
        : [option.defaultValue ?? option.min]);
    }

    [state.appearanceOverlays, state.itemOverlays] = await Promise.all([
      loadAppearanceOverlays(character),
      loadItemOverlays(character.name)
    ]);
    applyCharacterSprite(character);
    updateHiddenBaseLayers(character);
    setAnimationState(state.phase, state.direction);
    updateHairEditor();
    updateItemEditor();
    resetAnimationClock();
    await render();

    button.classList.remove('is-saved');
    void button.offsetWidth;
    button.classList.add('is-saved');
    setTimeout(() => button.classList.remove('is-saved'), 420);
  } catch (error) {
    state.equippedItemsByCharacter.set(character.name, previousItemIds);
    for (const [optionId, selection] of previousSelections) {
      if (selection === null) state.appearanceSelections.delete(optionId);
      else state.appearanceSelections.set(optionId, selection);
    }
    state.appearanceOverlays = previousAppearanceOverlays;
    state.itemOverlays = previousItemOverlays;
    applyCharacterSprite(character);
    updateHiddenBaseLayers(character);
    setAnimationState(state.phase, state.direction);
    updateHairEditor();
    updateItemEditor();
    resetAnimationClock();
    await render();
    button.classList.add('is-error');
    console.error(`配置槽位 ${slotIndex} 加载失败：`, error);
  } finally {
    state.appearanceSlotBusy = false;
    appearanceSlotButtons.forEach(slotButton => { slotButton.disabled = false; });
    hairResults.removeAttribute('aria-busy');
    itemResults.removeAttribute('aria-busy');
  }
}

async function loadItemOverlays(characterName) {
  const character = characterByName(characterName);
  const skinColor = activeColorOverride(characterName)?.skinColor ?? character?.skinColor;
  return Promise.all(equippedItems(characterName).map(item => (
    loadOverlayDefinition(item, character?.costumeSuffix, skinColor)
  )));
}

async function loadItemCatalog() {
  const resource = await window.isaac.readAsset('item-catalog.json');
  const catalog = JSON.parse(resource.value);
  if (!Array.isArray(catalog.items)) throw new Error('道具目录缺少 items 数组。');
  itemCatalog = catalog.items
    .filter(item => (
      Number.isInteger(item.gameId)
      && typeof item.id === 'string'
      && typeof item.animation === 'string'
      && typeof item.icon === 'string'
      && Array.isArray(item.parts)
    ))
    .map(item => ({ ...item, icon: browserAssetUrl(item.icon) }));
}

function activeAppearanceOverlays() {
  return [...state.appearanceOverlays, ...state.itemOverlays]
    .sort((left, right) => left.renderOrder - right.renderOrder);
}

function updateHiddenBaseLayers(character = activeCharacter()) {
  const hiddenLayers = [
    ...(character.hideBaseLayers || []),
    ...equippedItems(character.name).flatMap(item => item.hideBaseLayers || [])
  ];
  state.hiddenBaseLayers = new Set(hiddenLayers.map(name => name.toLowerCase()));
}

function activeHairOption() {
  return appearanceOptions(activeCharacter())
    .find(option => option.id === 'eden-hair') || null;
}

function updateCharacterVariantButton() {
  const base = baseCharacter();
  const variant = base.variants?.[0] || null;
  characterVariantToggle.hidden = !variant;
  if (!variant) return;
  const variantActive = activeCharacter().name === variant.name;
  const targetName = variantActive ? base.name : variant.name;
  characterVariantIcon.src = browserAssetUrl(variant.portrait);
  characterVariantToggle.title = `切换为 ${targetName}`;
  characterVariantToggle.setAttribute('aria-label', characterVariantToggle.title);
  characterVariantToggle.setAttribute('aria-pressed', String(variantActive));
}

function hairSpriteUrl(option, value) {
  return `url("${browserAssetUrl(`gfx/characters/costumes/${option.sprite(value)}`)}")`;
}

function refreshHairSelection(option = activeHairOption()) {
  if (!option) return;
  const selectedValues = appearanceValues(option);
  const selected = new Set(selectedValues);
  const iconValue = selectedValues.at(-1) ?? option.defaultValue ?? option.min;
  hairMenuToggle.querySelector('.hair-menu-icon').style.backgroundImage = hairSpriteUrl(option, iconValue);

  for (const button of hairResults.querySelectorAll('.hair-button')) {
    const value = Number(button.dataset.hair);
    const isSelected = selected.has(value);
    button.title = `${isSelected ? '移除' : '叠加'}发型 ${button.dataset.hair}`;
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-pressed', String(isSelected));
  }
}

function updateHairEditor() {
  const option = activeHairOption();
  hairMenuToggle.hidden = !option;
  if (!option) {
    hairResults.replaceChildren();
    delete hairResults.dataset.optionId;
    return;
  }

  const expectedCount = option.max - option.min + 1;
  const shouldBuild = hairResults.dataset.optionId !== option.id
    || hairResults.childElementCount !== expectedCount;
  if (!shouldBuild) {
    refreshHairSelection(option);
    return;
  }

  const fragment = document.createDocumentFragment();

  for (let value = option.min; value <= option.max; value += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hair-button';
    button.dataset.hair = String(value).padStart(2, '0');

    const preview = document.createElement('span');
    preview.className = 'hair-preview';
    preview.style.backgroundImage = hairSpriteUrl(option, value);
    button.append(preview);
    fragment.append(button);
  }
  hairResults.replaceChildren(fragment);
  hairResults.dataset.optionId = option.id;
  refreshHairSelection(option);
}

async function toggleHair(value) {
  const option = activeHairOption();
  if (!option || hairResults.getAttribute('aria-busy') === 'true') return;
  const previousValues = appearanceValues(option);
  const selected = new Set(previousValues);
  if (selected.has(value)) selected.delete(value);
  else selected.add(value);
  state.appearanceSelections.set(option.id, [...selected].sort((left, right) => left - right));
  hairResults.setAttribute('aria-busy', 'true');

  try {
    state.appearanceOverlays = await loadAppearanceOverlays(activeCharacter());
    setAnimationState(state.phase, state.direction);
    refreshHairSelection(option);
    resetAnimationClock();
    await render();
  } catch (error) {
    state.appearanceSelections.set(option.id, previousValues);
    state.appearanceOverlays = await loadAppearanceOverlays(activeCharacter());
    setAnimationState(state.phase, state.direction);
    refreshHairSelection(option);
    console.error(`发型 ${value} 切换失败：`, error);
  } finally {
    hairResults.removeAttribute('aria-busy');
  }
}

function updateItemEditor() {
  const selectedItems = equippedItemIds();
  const category = itemCategories[state.itemCategoryIndex];
  const equipmentFilter = itemEquipmentFilters[state.itemEquipmentFilterIndex];
  const query = itemSearch.value.trim().toLocaleLowerCase();
  const visibleItems = itemCatalog.filter(item => {
    const equipped = selectedItems.has(item.id);
    const matchesCategory = category.id === 'all'
      || (category.id === 'other' ? item.parts.length === 0 : item.parts.includes(category.id));
    const matchesEquipment = equipmentFilter.id === 'all'
      || (equipmentFilter.id === 'equipped' ? equipped : !equipped);
    const paddedId = String(item.gameId).padStart(3, '0');
    const searchableText = `${item.gameId} ${paddedId} ${item.id} ${item.name} ${item.englishName}`.toLocaleLowerCase();
    return matchesCategory && matchesEquipment && (!query || searchableText.includes(query));
  });

  itemCategoryFilter.textContent = category.shortLabel;
  itemCategoryFilter.title = `部件：${category.label}`;
  itemCategoryFilter.setAttribute('aria-label', `部件分类，当前${category.label}`);
  itemEquipmentFilter.textContent = equipmentFilter.shortLabel;
  itemEquipmentFilter.title = `显示：${equipmentFilter.label}`;
  itemEquipmentFilter.setAttribute('aria-label', `装备筛选，当前${equipmentFilter.label}`);
  itemResults.replaceChildren();

  for (const item of visibleItems) {
    const equipped = selectedItems.has(item.id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'item-button';
    button.dataset.itemId = item.id;
    button.title = `${equipped ? '移除' : '装备'} ${item.name} / ${item.englishName} (#${item.gameId})`;
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-pressed', String(equipped));

    const icon = document.createElement('img');
    icon.src = item.icon;
    icon.alt = '';
    icon.draggable = false;
    const idLabel = document.createElement('span');
    idLabel.className = 'item-id';
    idLabel.textContent = `#${String(item.gameId).padStart(3, '0')}`;
    button.append(icon, idLabel);
    itemResults.append(button);
  }

  itemEmpty.hidden = visibleItems.length > 0;
}

function syncSidePanelShape() {
  const side = state.hairMenuOpen && state.itemMenuOpen
    ? 'both'
    : state.hairMenuOpen
      ? 'left'
      : state.itemMenuOpen
        ? 'right'
        : null;
  window.isaac.setSidePanel(side);
}

async function setItemMenuOpen(open) {
  const nextOpen = Boolean(open);
  if (state.itemMenuTransitioning || nextOpen === state.itemMenuOpen) return;
  state.itemMenuTransitioning = true;
  itemMenuToggle.disabled = true;

  try {
    state.itemMenuOpen = nextOpen;
    desktopPet.classList.toggle('item-menu-open', nextOpen);
    itemPanel.hidden = !nextOpen;
    itemMenuToggle.setAttribute('aria-expanded', String(nextOpen));
    itemMenuToggle.setAttribute('aria-label', nextOpen ? '关闭道具菜单' : '打开道具菜单');
    syncSidePanelShape();

    if (nextOpen) {
      updateItemEditor();
      requestAnimationFrame(() => itemSearch.focus());
    }
  } finally {
    state.itemMenuTransitioning = false;
    itemMenuToggle.disabled = false;
  }
}

async function setHairMenuOpen(open) {
  const nextOpen = Boolean(open) && Boolean(activeHairOption());
  if (state.hairMenuTransitioning || nextOpen === state.hairMenuOpen) return;
  state.hairMenuTransitioning = true;
  hairMenuToggle.disabled = true;

  try {
    state.hairMenuOpen = nextOpen;
    desktopPet.classList.toggle('hair-menu-open', nextOpen);
    hairPanel.hidden = !nextOpen;
    hairMenuToggle.setAttribute('aria-expanded', String(nextOpen));
    hairMenuToggle.setAttribute('aria-label', nextOpen ? '关闭发型菜单' : '打开发型菜单');
    syncSidePanelShape();
  } finally {
    state.hairMenuTransitioning = false;
    hairMenuToggle.disabled = false;
  }
}

async function toggleItem(itemId) {
  const item = itemCatalog.find(entry => entry.id === itemId);
  if (!item || itemResults.getAttribute('aria-busy') === 'true') return;
  const character = activeCharacter();
  const selectedItems = equippedItemIds(character.name);
  const wasEquipped = selectedItems.has(itemId);
  const previousOverlays = state.itemOverlays;
  if (wasEquipped) selectedItems.delete(itemId);
  else selectedItems.add(itemId);
  itemResults.setAttribute('aria-busy', 'true');

  try {
    state.itemOverlays = await loadItemOverlays(character.name);
    applyCharacterSprite(character);
    updateHiddenBaseLayers(character);
    setAnimationState(state.phase, state.direction);
    updateItemEditor();
    resetAnimationClock();
    await render();
  } catch (error) {
    if (wasEquipped) selectedItems.add(itemId);
    else selectedItems.delete(itemId);
    state.itemOverlays = previousOverlays;
    applyCharacterSprite(character);
    updateHiddenBaseLayers(character);
    setAnimationState(state.phase, state.direction);
    console.error(`道具外观加载失败：${item.name}`, error);
    updateItemEditor();
  } finally {
    itemResults.removeAttribute('aria-busy');
  }
}

function applyCharacterSprite(character) {
  if (!state.actor) return;
  const sourceSheet = state.characterSheet
    || state.actor.layers.find(layer => layer.spriteSheet?.toLowerCase().includes('/characters/costumes/'))?.spriteSheet;
  const colorOverride = activeColorOverride(character.name);
  const suffix = colorOverride ? skinColorSuffixes[colorOverride.skinColor] : null;
  const spriteStem = character.sprite.replace(/\.png$/i, '');
  const sprite = suffix && character.skinVariants
    ? `${spriteStem}_${suffix}.png`
    : character.sprite;
  const targetSheet = `gfx/characters/costumes/${sprite}`;
  for (const layer of state.actor.layers) {
    if (layer.spriteSheet === sourceSheet) layer.spriteSheet = targetSheet;
  }
  state.characterSheet = targetSheet;
  state.baseSkinTransform = colorOverride && !character.skinVariants
    && character.skinColor !== colorOverride.skinColor
    ? { source: character.skinColor, target: colorOverride.skinColor }
    : null;
}

function applyLoadedCharacter(character, appearanceOverlays, itemOverlays) {
  applyCharacterSprite(character);
  state.appearanceOverlays = appearanceOverlays;
  state.itemOverlays = itemOverlays;
  updateHiddenBaseLayers(character);
  setAnimationState(state.phase, state.direction);
  updateHairEditor();
  updateItemEditor();
  updateAppearanceSlotButtons();
  updateCharacterVariantButton();
}

async function toggleCharacterVariant() {
  const base = baseCharacter();
  const variant = base.variants?.[0];
  if (!state.actor
    || !variant
    || state.appearanceSlotBusy
    || state.characterVariantTransitioning
    || hairResults.getAttribute('aria-busy') === 'true'
    || itemResults.getAttribute('aria-busy') === 'true') return;
  const variantActive = activeCharacter().name === variant.name;
  const nextCharacter = variantActive ? base : variant;
  state.characterVariantTransitioning = true;
  characterVariantToggle.disabled = true;
  hairResults.setAttribute('aria-busy', 'true');
  itemResults.setAttribute('aria-busy', 'true');

  try {
    const [nextOverlays, nextItemOverlays] = await Promise.all([
      loadAppearanceOverlays(nextCharacter),
      loadItemOverlays(nextCharacter.name)
    ]);
    if (variantActive) state.characterVariants.delete(base.name);
    else state.characterVariants.set(base.name, variant.name);
    applyLoadedCharacter(nextCharacter, nextOverlays, nextItemOverlays);
    resetAnimationClock();
    await render();
  } catch (error) {
    console.error(`角色变体加载失败：${nextCharacter.name}`, error);
  } finally {
    state.characterVariantTransitioning = false;
    characterVariantToggle.disabled = false;
    hairResults.removeAttribute('aria-busy');
    itemResults.removeAttribute('aria-busy');
  }
}

async function switchCharacter(step) {
  if (!state.actor
    || state.appearanceSlotBusy
    || state.characterVariantTransitioning
    || !Number.isFinite(step)) return;
  if (state.hairMenuOpen) await setHairMenuOpen(false);
  const count = characterCatalog.length;
  const nextIndex = (state.characterIndex + step + count) % count;
  const nextCharacter = activeCharacter(nextIndex);
  try {
    const [nextOverlays, nextItemOverlays] = await Promise.all([
      loadAppearanceOverlays(nextCharacter),
      loadItemOverlays(nextCharacter.name)
    ]);
    state.characterIndex = nextIndex;
    applyLoadedCharacter(nextCharacter, nextOverlays, nextItemOverlays);
  } catch (error) {
    console.error(`角色外观加载失败：${nextCharacter.name}`, error);
    return;
  }
  resetAnimationClock();
  await render();
}

function findActorAnimation(actor, name) {
  return actor?.animations.find(animation => animation.name === name);
}

function findAnimation(name) {
  return findActorAnimation(state.actor, name);
}

function animationForState(phase, direction) {
  const preferredName = `${phase === 'idle' ? 'Idle' : 'Walk'}${direction}`;
  return findAnimation(preferredName)
    || findAnimation(`Walk${direction}`)
    || findAnimation(state.actor.defaultAnimation)
    || state.actor.animations[0];
}

function movementAnimationForActor(actor, phase, direction) {
  const preferredName = `${phase === 'idle' ? 'Idle' : 'Walk'}${direction}`;
  return findActorAnimation(actor, preferredName)
    || findActorAnimation(actor, `Walk${direction}`)
    || findActorAnimation(actor, actor.defaultAnimation)
    || actor.animations[0];
}

function firstDirectionalAnimation(actor, prefix, suffix = '') {
  return ['Down', 'Right', 'Up', 'Left']
    .map(candidateDirection => findActorAnimation(actor, `${prefix}${candidateDirection}${suffix}`))
    .find(Boolean);
}

function trackAnimationForState(actor, source, phase, direction) {
  if (source === 'movement') return movementAnimationForActor(actor, phase, direction);
  if (source === 'headOverlay') {
    return findActorAnimation(actor, `Head${direction}_Overlay`)
      || firstDirectionalAnimation(actor, 'Head', '_Overlay');
  }
  if (source === 'head') {
    return findActorAnimation(actor, `Head${direction}`)
      || firstDirectionalAnimation(actor, 'Head')
      || movementAnimationForActor(actor, phase, direction);
  }
  return findActorAnimation(actor, actor.defaultAnimation)
    || actor.animations[0]
    || movementAnimationForActor(actor, phase, direction);
}

function resetAnimationClock(time = performance.now()) {
  state.tick = 0;
  state.lastTime = time;
  state.lastRenderTime = time;
  state.appearanceStartTime = time;
}

function setAnimationState(phase, direction) {
  if (!state.actor) return;
  const nextAnimation = animationForState(phase, direction);
  const changed = state.animation !== nextAnimation || state.phase !== phase || state.direction !== direction;
  state.phase = phase;
  state.direction = direction;
  state.animation = nextAnimation;
  state.overlays = [];
  const head = findAnimation(`Head${direction}`);
  if (head) state.overlays.push(head);
  for (const overlay of activeAppearanceOverlays()) {
    for (const track of overlay.tracks) {
      track.animation = trackAnimationForState(overlay.actor, track.source, phase, direction);
    }
  }
  if (changed) {
    resetAnimationClock();
  }
}

function activeDirection() {
  const keys = [...state.heldKeys];
  for (let index = keys.length - 1; index >= 0; index -= 1) {
    const direction = directionKeys[keys[index]];
    if (direction) return direction;
  }
  return null;
}

function drawFrame(frame, image, rootFrame, offsetX = 0, offsetY = 0) {
  if (!frame || !frame.visible || !image || frame.width <= 0 || frame.height <= 0) return;
  const originX = 40;
  const originY = 66;
  context.save();
  context.globalAlpha = frame.alpha;
  context.translate(
    originX + offsetX + (rootFrame?.x || 0) + frame.x,
    originY + offsetY + (rootFrame?.y || 0) + frame.y
  );
  context.rotate(frame.rotation);
  context.scale(frame.scaleX, frame.scaleY);
  context.drawImage(image, frame.cropX, frame.cropY, frame.width, frame.height, -frame.pivotX, -frame.pivotY, frame.width, frame.height);
  context.restore();
}

async function renderAnimation(actor, animation, tick, {
  includeLayers = null,
  includeLayerIds = null,
  excludeLayers = null,
  offsetX = 0,
  offsetY = 0,
  skinTransform = null
} = {}) {
  if (!actor || !animation) return;
  const safeTick = Math.max(0, Math.floor(tick));
  const animationTick = animation.loop
    ? safeTick % animation.frameCount
    : Math.min(safeTick, Math.max(0, animation.frameCount - 1));
  const rootFrame = parseFrame(animation.rootFrames[Math.min(animationTick, animation.rootFrames.length - 1)]);
  for (const layer of actor.layers) {
    const layerName = layer.name.toLowerCase();
    if (includeLayers && !includeLayers.has(layerName)) continue;
    if (includeLayerIds && !includeLayerIds.has(layer.id)) continue;
    if (excludeLayers?.has(layerName)) continue;
    const frames = animation.layerAnimations.get(layer.id);
    if (!frames?.length) continue;
    const frame = parseFrame(frames[Math.min(animationTick, frames.length - 1)]);
    const activeSkinTransform = skinTransform
      || (actor === state.actor && layer.spriteSheet === state.characterSheet ? state.baseSkinTransform : null);
    const image = activeSkinTransform
      ? await loadSkinTransformedImage(
        layer.spriteSheet,
        activeSkinTransform.source,
        activeSkinTransform.target
      )
      : await loadImage(layer.spriteSheet);
    drawFrame(frame, image, rootFrame, offsetX, offsetY);
  }
}

function appearanceTrackTick(overlay, track, time) {
  if (track.source === 'movement') {
    const frozenByFlight = characterCanFly() && !track.animateWhileFlying;
    return state.phase === 'walk' && !frozenByFlight ? state.tick : 0;
  }
  if (!track.animation?.loop) return 0;
  return Math.floor((time - state.appearanceStartTime) * overlay.actor.fps / 1000);
}

function loopingAppearanceFps() {
  let fps = 0;
  for (const overlay of activeAppearanceOverlays()) {
    const hasLoopingTrack = overlay.tracks.some(track => (
      track.source !== 'movement'
      && track.animation?.loop
      && track.animation.frameCount > 1
    ));
    if (hasLoopingTrack) fps = Math.max(fps, overlay.actor.fps);
  }
  return fps;
}

function appearanceLayerRank(layerName) {
  const normalizedName = layerName.toLowerCase();
  const baseLayerIndex = state.actor?.layers.findIndex(layer => (
    layer.name.toLowerCase() === normalizedName
  ));
  return baseLayerIndex >= 0 ? baseLayerIndex : Number.MAX_SAFE_INTEGER;
}

async function renderAppearanceTracks(placement, time) {
  const layerJobs = [];
  let sequence = 0;
  for (const overlay of activeAppearanceOverlays()) {
    for (const track of overlay.tracks) {
      if (track.placement !== placement) continue;
      const tick = appearanceTrackTick(overlay, track, time);
      for (const layer of overlay.actor.layers) {
        const layerName = layer.name.toLowerCase();
        if (track.layers && !track.layers.has(layerName)) continue;
        if (!track.animation?.layerAnimations.get(layer.id)?.length) continue;
        layerJobs.push({ overlay, track, layer, tick, sequence });
        sequence += 1;
      }
    }
  }
  layerJobs.sort((left, right) => (
    appearanceLayerRank(left.layer.name) - appearanceLayerRank(right.layer.name)
    || left.sequence - right.sequence
  ));
  for (const job of layerJobs) {
    await renderAnimation(job.overlay.actor, job.track.animation, job.tick, {
      includeLayerIds: new Set([job.layer.id]),
      offsetX: job.track.offsetX,
      offsetY: job.track.offsetY,
      skinTransform: job.track.inheritsSkinColor ? state.baseSkinTransform : null
    });
  }
}

async function render(time = performance.now()) {
  if (!state.actor || !state.animation) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  await renderAppearanceTracks('beforeBase', time);
  const movementTick = state.phase === 'walk' && characterCanFly() ? 0 : state.tick;
  await renderAnimation(state.actor, state.animation, movementTick, { excludeLayers: state.hiddenBaseLayers });
  await renderAppearanceTracks('afterBody', time);
  for (const animation of state.overlays) {
    await renderAnimation(state.actor, animation, 0, { excludeLayers: state.hiddenBaseLayers });
  }
  await renderAppearanceTracks('afterBase', time);
}

async function frameLoop(time) {
  if (state.actor && state.animation) {
    const elapsedSeconds = Math.min(0.05, Math.max(0, (time - state.lastMovementTime) / 1000));
    state.lastMovementTime = time;
    let deltaX = 0;
    let deltaY = 0;
    if (state.phase === 'walk') {
      if (isDirectionHeld('Left')) deltaX -= 120 * elapsedSeconds;
      if (isDirectionHeld('Right')) deltaX += 120 * elapsedSeconds;
      if (isDirectionHeld('Up')) deltaY -= 120 * elapsedSeconds;
      if (isDirectionHeld('Down')) deltaY += 120 * elapsedSeconds;
      if (deltaX || deltaY) window.isaac.nudgeWindow(deltaX, deltaY);
    }
    const frameDuration = 1000 / state.actor.fps;
    const idleAnimation = state.phase === 'idle' && state.animation.name === `Idle${state.direction}`;
    let shouldRender = false;
    if ((state.phase === 'walk' || idleAnimation) && time - state.lastTime >= frameDuration) {
      const elapsedFrames = Math.floor((time - state.lastTime) / frameDuration);
      state.lastTime += elapsedFrames * frameDuration;
      state.tick += elapsedFrames;
      if (state.tick >= state.animation.frameCount) {
        state.tick = state.animation.loop ? state.tick % state.animation.frameCount : state.animation.frameCount - 1;
      }
      shouldRender = true;
    }
    const appearanceFps = loopingAppearanceFps();
    if (appearanceFps > 0 && time - state.lastRenderTime >= 1000 / appearanceFps) {
      shouldRender = true;
    }
    if (shouldRender) {
      state.lastRenderTime = time;
      await render(time);
    }
  } else {
    state.lastMovementTime = time;
  }
  requestAnimationFrame(frameLoop);
}

async function loadDefaultCharacter() {
  await loadItemCatalog();
  const savedSlots = await window.isaac.loadAppearanceSlots();
  state.appearanceSlots = savedSlots.characters || {};
  const entry = await window.isaac.getPlayerEntry();
  const actorResource = await window.isaac.readAsset(entry.animation);
  state.actor = parseAnm2(actorResource.value, entry.animation);
  state.characterSheet = state.actor.layers.find(layer => layer.spriteSheet?.toLowerCase().includes('/characters/costumes/'))?.spriteSheet;
  const character = activeCharacter();
  applyCharacterSprite(character);
  state.appearanceOverlays = await loadAppearanceOverlays(character);
  state.itemOverlays = await loadItemOverlays(character.name);
  updateHiddenBaseLayers(character);
  setAnimationState('idle', 'Down');
  updateHairEditor();
  updateItemEditor();
  updateAppearanceSlotButtons();
  updateCharacterVariantButton();
  await render();
}

function isEditableTarget(target) {
  return target instanceof HTMLElement && Boolean(target.closest('input, select, textarea, [contenteditable="true"]'));
}

window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && (state.itemMenuOpen || state.hairMenuOpen)) {
    event.preventDefault();
    const menuToggle = state.hairMenuOpen ? hairMenuToggle : itemMenuToggle;
    const closeMenu = state.hairMenuOpen ? setHairMenuOpen(false) : setItemMenuOpen(false);
    closeMenu
      .then(() => menuToggle.focus())
      .catch(error => console.error('侧边菜单关闭失败：', error));
    return;
  }
  if (isEditableTarget(event.target)) return;
  const direction = directionForEvent(event);
  if (!direction) return;
  event.preventDefault();
  keyNames(event).forEach(key => state.heldKeys.add(key));
  if (!event.repeat) setAnimationState('walk', direction);
});

window.addEventListener('keyup', event => {
  const direction = directionForEvent(event);
  if (!direction) return;
  const keys = keyNames(event);
  const releasedHeldKey = keys.some(key => state.heldKeys.has(key));
  if (isEditableTarget(event.target) && !releasedHeldKey) return;
  if (!isEditableTarget(event.target)) event.preventDefault();
  keys.forEach(key => state.heldKeys.delete(key));
  const nextDirection = activeDirection();
  if (nextDirection) {
    setAnimationState('walk', nextDirection);
  } else {
    setAnimationState('idle', state.direction);
    state.tick = 0;
    render().catch(error => console.error('待机姿态绘制失败：', error));
  }
});

window.addEventListener('blur', () => {
  state.heldKeys.clear();
  setAnimationState('idle', state.direction);
  state.tick = 0;
  render().catch(error => console.error('失焦待机姿态绘制失败：', error));
});

dragHandle.addEventListener('mousedown', async event => {
  if (event.button !== 0) return;
  const bounds = await window.isaac.getWindowBounds();
  state.dragging = { startX: event.screenX, startY: event.screenY, windowX: bounds.x, windowY: bounds.y };
  event.preventDefault();
});

window.addEventListener('mousemove', event => {
  if (!state.dragging) return;
  if ((event.buttons & 1) === 0) { state.dragging = null; return; }
  window.isaac.moveWindow(
    state.dragging.windowX + event.screenX - state.dragging.startX,
    state.dragging.windowY + event.screenY - state.dragging.startY
  );
});

window.addEventListener('mouseup', () => { state.dragging = null; });
window.addEventListener('blur', () => { state.dragging = null; });
window.addEventListener('contextmenu', event => { event.preventDefault(); window.isaac.showMenu(); });

document.querySelectorAll('.character-switch-button').forEach(button => {
  button.addEventListener('click', event => {
    event.stopPropagation();
    switchCharacter(Number(button.dataset.characterStep))
      .catch(error => console.error('角色切换失败：', error));
  });
});

hairMenuToggle.addEventListener('click', event => {
  event.stopPropagation();
  setHairMenuOpen(!state.hairMenuOpen)
    .catch(error => console.error('发型菜单切换失败：', error));
});

hairResults.addEventListener('click', event => {
  const button = event.target.closest('.hair-button');
  if (!button) return;
  event.stopPropagation();
  toggleHair(Number(button.dataset.hair))
    .catch(error => console.error('发型切换失败：', error));
});

itemMenuToggle.addEventListener('click', event => {
  event.stopPropagation();
  setItemMenuOpen(!state.itemMenuOpen)
    .catch(error => console.error('道具菜单切换失败：', error));
});

characterVariantToggle.addEventListener('click', event => {
  event.stopPropagation();
  toggleCharacterVariant().catch(error => console.error('角色变体切换失败：', error));
});

appearanceSlotButtons.forEach(button => {
  button.addEventListener('click', event => {
    event.stopPropagation();
    const slotIndex = Number(button.dataset.slot);
    const character = activeCharacter();
    const isFilled = Boolean(state.appearanceSlots[character.name]?.[String(slotIndex)]);
    const operation = isFilled && !event.shiftKey
      ? loadAppearanceSlot(slotIndex, button)
      : saveCurrentAppearanceSlot(slotIndex, button);
    operation.catch(error => console.error('外观配置操作失败：', error));
  });
});

itemSearch.addEventListener('input', updateItemEditor);

itemCategoryFilter.addEventListener('click', () => {
  state.itemCategoryIndex = (state.itemCategoryIndex + 1) % itemCategories.length;
  updateItemEditor();
});

itemEquipmentFilter.addEventListener('click', () => {
  state.itemEquipmentFilterIndex = (state.itemEquipmentFilterIndex + 1) % itemEquipmentFilters.length;
  updateItemEditor();
});

itemResults.addEventListener('click', event => {
  const button = event.target.closest('.item-button');
  if (!button) return;
  event.stopPropagation();
  toggleItem(button.dataset.itemId).catch(error => console.error('道具切换失败：', error));
});

loadDefaultCharacter().catch(error => console.error('角色加载失败：', error));
requestAnimationFrame(frameLoop);
