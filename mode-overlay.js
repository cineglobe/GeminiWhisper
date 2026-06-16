window.addEventListener('DOMContentLoaded', () => {
  const icon = document.getElementById('mode-icon');
  const name = document.getElementById('mode-name');

  window.electronAPI.onShowMode((mode) => {
    icon.textContent = mode.icon || '🎤';
    icon.style.background = mode.color || '#2563eb';
    name.textContent = mode.name || 'Normal';
  });
});
