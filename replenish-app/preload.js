const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('frictionFlowBridge', {
  importSync: () => ipcRenderer.invoke('import-frictionflow-file'),
});
