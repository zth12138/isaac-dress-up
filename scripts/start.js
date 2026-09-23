const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const executableName = process.platform === 'win32' ? 'electron.exe' : 'electron';
const candidates = [
  process.env.ELECTRON_PATH,
  path.join(projectRoot, 'node_modules', 'electron', 'dist', executableName),
  path.resolve(projectRoot, '..', '桌面D6', 'node_modules', 'electron', 'dist', executableName)
].filter(Boolean);
const electronPath = candidates.find(candidate => fs.existsSync(candidate));

if (!electronPath) {
  console.error('找不到 Electron 运行时。请重新安装 electron，或设置 ELECTRON_PATH 指向 electron.exe。');
  process.exit(1);
}

const child = spawn(electronPath, [projectRoot], {
  cwd: projectRoot,
  stdio: 'inherit',
  windowsHide: false
});

child.on('error', error => {
  console.error(`Electron 启动失败：${error.message}`);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  process.exitCode = typeof code === 'number' ? code : 1;
  if (signal) console.error(`Electron 被信号 ${signal} 终止。`);
});
