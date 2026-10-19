const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('desktop', Object.freeze({
  loadDraft: () => ipcRenderer.invoke('editor:load-draft'),
  saveDraft: doc => ipcRenderer.invoke('editor:save-draft', doc),
  saveFile: file => ipcRenderer.invoke('editor:save-file', file),
  exportPDF: (job, name) => ipcRenderer.invoke('editor:export-pdf', job, name),
  resolveImage: url => ipcRenderer.invoke('editor:resolve-image', url),
  onCommand: callback => {
    const listener = (_event, command) => callback(command);
    ipcRenderer.on('editor:command', listener);
    return () => ipcRenderer.removeListener('editor:command', listener);
  },
  onBeforeClose: callback => {
    const listener = async (_event, token) => {
      try { await callback(); ipcRenderer.send('editor:close-ready', token, true); }
      catch (error) { ipcRenderer.send('editor:close-ready', token, false, String(error.message)); }
    };
    ipcRenderer.on('editor:before-close', listener);
    ipcRenderer.send('editor:close-listener', true);
    return () => {
      ipcRenderer.removeListener('editor:before-close', listener);
      ipcRenderer.send('editor:close-listener', false);
    };
  }
}));
