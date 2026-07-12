const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('carouselApi', {
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  loadDynasty: (dynastyName, customSaveDirectory) => ipcRenderer.invoke('dynasty:load', dynastyName, customSaveDirectory),
  moveCandidate: (payload) => ipcRenderer.invoke('candidate:move', payload),
  replaceCoach: (payload) => ipcRenderer.invoke('candidate:replace-coach', payload),
  selectDirectory: () => ipcRenderer.invoke('app:select-directory'),
  save: () => ipcRenderer.invoke('dynasty:save'),
  updateInterest: (payload) => ipcRenderer.invoke('candidate:update-interest', payload)
});
