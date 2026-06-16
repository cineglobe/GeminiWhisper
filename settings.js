const MODEL_OPTIONS = [
  ['gemini-3.5-flash', 'Gemini 3.5 Flash - recommended'],
  ['gemini-flash-latest', 'Gemini Flash Latest - auto-updating alias'],
  ['gemini-3.1-pro-preview', 'Gemini 3.1 Pro Preview - complex formatting'],
  ['gemini-2.5-flash', 'Gemini 2.5 Flash - reliable fallback'],
  ['gemini-2.5-pro', 'Gemini 2.5 Pro - advanced fallback'],
  ['gemini-2.5-flash-lite', 'Gemini 2.5 Flash-Lite - fast and low cost']
];

function addModelOption(select, value, label, selectedValue) {
  if ([...select.options].some(option => option.value === value)) return;
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  option.selected = value === selectedValue;
  select.appendChild(option);
}

function setStatus(message, tone = 'neutral') {
  const status = document.getElementById('status');
  status.textContent = message;
  status.dataset.tone = tone;
}

async function loadModels(apiKey, selectedValue) {
  const modelSelect = document.getElementById('selectedModel');
  MODEL_OPTIONS.forEach(([value, label]) => addModelOption(modelSelect, value, label, selectedValue));
  modelSelect.value = selectedValue || 'gemini-3.5-flash';

  const result = await window.electronAPI.fetchGeminiModels(apiKey);
  if (!result?.success || !Array.isArray(result.models)) return;

  result.models.forEach(model => {
    const badge = model.badgeType ? ` (${model.badgeType})` : '';
    addModelOption(modelSelect, model.name, `${model.displayName || model.name}${badge}`, selectedValue);
  });

  if (selectedValue) modelSelect.value = selectedValue;
}

window.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('settings-form');
  const apiKeyInput = document.getElementById('apiKey');
  const currentModeSelect = document.getElementById('currentMode');
  const selectedModelSelect = document.getElementById('selectedModel');
  const autoPasteInput = document.getElementById('autoPaste');
  const showNotificationsInput = document.getElementById('showNotifications');
  const autoStartInput = document.getElementById('autoStart');
  const audioQualitySelect = document.getElementById('audioQuality');
  const overlayPositionSelect = document.getElementById('overlayPosition');
  const testButton = document.getElementById('test-api-key');
  const refreshModelsButton = document.getElementById('refresh-models');
  const version = document.getElementById('version');

  const settings = await window.electronAPI.getSettings();
  apiKeyInput.value = settings.apiKey || '';
  currentModeSelect.value = settings.currentMode || 'normal';
  autoPasteInput.checked = settings.autoPaste !== false;
  showNotificationsInput.checked = Boolean(settings.showNotifications);
  autoStartInput.checked = settings.autoStart !== false;
  audioQualitySelect.value = settings.audioQuality || 'high';
  overlayPositionSelect.value = settings.overlayPosition || 'center';
  version.textContent = await window.electronAPI.getVersion();

  await loadModels(settings.apiKey, settings.selectedModel || 'gemini-3.5-flash');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await window.electronAPI.setSettings({
      apiKey: apiKeyInput.value.trim(),
      currentMode: currentModeSelect.value,
      selectedModel: selectedModelSelect.value,
      autoPaste: autoPasteInput.checked,
      showNotifications: showNotificationsInput.checked,
      autoStart: autoStartInput.checked,
      audioQuality: audioQualitySelect.value,
      overlayPosition: overlayPositionSelect.value
    });
    setStatus('Settings saved.', 'success');
  });

  testButton.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      setStatus('Enter an API key before testing.', 'error');
      return;
    }

    testButton.disabled = true;
    setStatus('Testing API key...', 'neutral');
    const result = await window.electronAPI.testApiKey(apiKey);
    testButton.disabled = false;
    setStatus(result.success ? 'API key works.' : `API test failed: ${result.error}`, result.success ? 'success' : 'error');
  });

  refreshModelsButton.addEventListener('click', async () => {
    refreshModelsButton.disabled = true;
    setStatus('Refreshing model list...', 'neutral');
    const selected = selectedModelSelect.value;
    selectedModelSelect.innerHTML = '';
    await loadModels(apiKeyInput.value.trim(), selected);
    refreshModelsButton.disabled = false;
    setStatus('Model list refreshed.', 'success');
  });
});
