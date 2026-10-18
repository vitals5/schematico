// electron/preload.cjs
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  macroLibrary: {
    getFolder: () => ipcRenderer.invoke('macroLibrary:getFolder'),
    setFolder: path => ipcRenderer.invoke('macroLibrary:setFolder', path),
    chooseFolder: () => ipcRenderer.invoke('macroLibrary:chooseFolder'),
    list: () => ipcRenderer.invoke('macroLibrary:list'),
    read: relativePath => ipcRenderer.invoke('macroLibrary:read', relativePath)
  },
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  onMenuAction: (channel, callback) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  }
});
