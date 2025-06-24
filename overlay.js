const { ipcRenderer } = require('electron');
window.addEventListener('DOMContentLoaded', () => {
  const statusText = document.getElementById('status-text');
  ipcRenderer.on('overlay-status', (event, statusData) => {
    statusText.textContent = statusData.message;
    if (statusData.status === 'success') {
      statusText.style.color = '#19e15b';
    } else if (statusData.status === 'error') {
      statusText.style.color = '#ef4444';
    } else {
      statusText.style.color = '#222';
    }
  });
});
