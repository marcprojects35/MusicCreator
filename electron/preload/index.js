const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Dialog
  openFile: (opts) => ipcRenderer.invoke('dialog:open-file', opts),
  saveFile: (opts) => ipcRenderer.invoke('dialog:save-file', opts),

  // Store
  storeGet: (key) => ipcRenderer.invoke('store:get', key),
  storeSet: (key, val) => ipcRenderer.invoke('store:set', key, val),
  storeDelete: (key) => ipcRenderer.invoke('store:delete', key),

  // File system
  readFile: (path) => ipcRenderer.invoke('fs:read', path),
  writeFile: (path, data) => ipcRenderer.invoke('fs:write', path, data),
  listDir: (path) => ipcRenderer.invoke('fs:list-dir', path),

  // App
  getPath: (name) => ipcRenderer.invoke('app:get-path', name),
  getVersion: () => ipcRenderer.invoke('app:get-version'),

  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  // Events from main
  on: (channel, cb) => {
    const validChannels = [
      'menu:new-project', 'menu:save', 'menu:export', 'menu:undo', 'menu:redo',
      'menu:view', 'project:open'
    ]
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_, ...args) => cb(...args))
    }
  },
  off: (channel, cb) => ipcRenderer.removeListener(channel, cb)
})
