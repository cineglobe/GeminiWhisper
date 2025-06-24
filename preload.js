const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Settings management
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (settings) => ipcRenderer.invoke('set-settings', settings),
  
  // Custom modes management
  createCustomMode: (mode) => ipcRenderer.invoke('create-custom-mode', mode),
  updateCustomMode: (mode) => ipcRenderer.invoke('update-custom-mode', mode),
  deleteCustomMode: (modeId) => ipcRenderer.invoke('delete-custom-mode', modeId),
  
  // API testing
  testApiKey: (apiKey) => ipcRenderer.invoke('test-api-key', apiKey),
  fetchGeminiModels: (apiKey) => ipcRenderer.invoke('fetch-gemini-models', apiKey),
  getDefaultPrompt: () => ipcRenderer.invoke('get-default-prompt'),
  
  // App info
  getVersion: () => ipcRenderer.invoke('get-version'),
  
  // Recording management
  getRecordings: () => ipcRenderer.invoke('get-recordings'),
  deleteRecording: (recordingId) => ipcRenderer.invoke('delete-recording', recordingId),
  playRecording: (recordingId) => ipcRenderer.invoke('play-recording', recordingId),
  clearAllRecordings: () => ipcRenderer.invoke('clear-all-recordings'),
  getRecordingFile: (recordingId) => ipcRenderer.invoke('get-recording-file', recordingId),
  
  // Overlay communication
  onOverlayStatus: (callback) => {
    ipcRenderer.on('overlay-status', (event, data) => callback(data));
  },
  
  // Mode switching overlay
  onShowMode: (callback) => {
    ipcRenderer.on('show-mode', (event, data) => callback(data));
  },
  
  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
}); 