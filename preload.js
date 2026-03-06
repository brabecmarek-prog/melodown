const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // Window controls
  minimize: () => ipcRenderer.send('win-minimize'),
  maximize: () => ipcRenderer.send('win-maximize'),
  close: () => ipcRenderer.send('win-close'),

  // Dialogs
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  pickFile: () => ipcRenderer.invoke('pick-file'),
  openFolder: (p) => ipcRenderer.send('open-folder', p),

  // Playlist fetch
  fetchPlaylist: (args) => ipcRenderer.invoke('fetch-playlist', args),

  // Download
  startDownload: (args) => ipcRenderer.invoke('start-download', args),
  stopDownload: () => ipcRenderer.send('stop-download'),

  // Events from main process
  on: (channel, cb) => ipcRenderer.on(channel, (_, data) => cb(data)),
  off: (channel) => ipcRenderer.removeAllListeners(channel)
})
