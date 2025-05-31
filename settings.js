const { ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('settings-form');
  const apiKeyInput = document.getElementById('apiKey');
  const modeSelect = document.getElementById('mode');
  const modelSelect = document.getElementById('model');

  // Load current settings
  const settings = await ipcRenderer.invoke('get-settings');
  apiKeyInput.value = settings.apiKey || '';
  modeSelect.value = settings.mode || 'normal';
  modelSelect.value = settings.model || 'gemini-2.5-flash-preview-05-20';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await ipcRenderer.invoke('set-settings', {
      apiKey: apiKeyInput.value.trim(),
      mode: modeSelect.value,
      model: modelSelect.value
    });
    alert('Settings saved!');
  });
});
