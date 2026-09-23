const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('isaac', {
  readAsset: relativePath => ipcRenderer.invoke('asset-read', relativePath),
  getAssetRoot: () => ipcRenderer.invoke('asset-root'),
  getPlayerEntry: () => ipcRenderer.invoke('player-entry'),
  getWindowBounds: () => ipcRenderer.invoke('window-bounds'),
  moveWindow: (x, y) => ipcRenderer.send('window-move', x, y),
  nudgeWindow: (deltaX, deltaY) => ipcRenderer.send('window-nudge', deltaX, deltaY),
  setSidePanel: side => ipcRenderer.sendSync('side-panel-set', side),
  loadAppearanceSlots: () => ipcRenderer.invoke('appearance-slots-load'),
  saveAppearanceSlot: (characterName, slotIndex, configuration) => (
    ipcRenderer.invoke('appearance-slot-save', characterName, slotIndex, configuration)
  ),
  showMenu: () => ipcRenderer.send('window-menu')
});
