const { ipcRenderer } = require('electron');
window.addEventListener('DOMContentLoaded', () => {
  const statusText = document.getElementById('status-text');
  ipcRenderer.on('overlay-status', (event, status) => {
    statusText.textContent = status;
    if (status === 'Copied!') {
      statusText.style.color = '#19e15b';
    } else {
      statusText.style.color = '#222';
    }
  });
});
