const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  minimize: () => ipcRenderer.send('win-minimize'),
  maximize: () => ipcRenderer.send('win-maximize'),
  close: () => ipcRenderer.send('win-close'),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  pickFile: () => ipcRenderer.invoke('pick-file'),
  openFolder: (p) => ipcRenderer.send('open-folder', p),
  fetchPlaylist: (args) => ipcRenderer.invoke('fetch-playlist', args),
  startDownload: (args) => ipcRenderer.invoke('start-download', args),
  stopDownload: () => ipcRenderer.send('stop-download'),
  downloadUpdate: (url) => ipcRenderer.send('download-update', url),
  dismissUpdate: () => ipcRenderer.send('dismiss-update'),
  on: (channel, cb) => ipcRenderer.on(channel, (_, data) => cb(data)),
  off: (channel) => ipcRenderer.removeAllListeners(channel)
})
