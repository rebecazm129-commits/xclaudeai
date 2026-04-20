const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('xclaude', {
  getState: () => ipcRenderer.invoke('get-state'),
  getEvents: () => ipcRenderer.invoke('get-events'),
  runSetup: () => ipcRenderer.invoke('run-setup'),
  openClaude: () => ipcRenderer.invoke('open-claude'),
  onSetupOutput: (cb) => ipcRenderer.on('setup-output', (_, d) => cb(d))
});
