const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  scanFiles: (data) => ipcRenderer.invoke('scan-files', data),
  copyFiles: (data) => ipcRenderer.invoke('copy-files', data),
  abortCopy: () => ipcRenderer.send('abort-copy'),
  onCopyProgress: (callback) => {
    ipcRenderer.removeAllListeners('copy-progress');
    ipcRenderer.on('copy-progress', (event, data) => callback(data));
  },
  onCopyAborted: (callback) => {
    ipcRenderer.removeAllListeners('copy-aborted');
    ipcRenderer.on('copy-aborted', () => callback());
  },
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
});
