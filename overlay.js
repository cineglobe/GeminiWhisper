window.addEventListener('DOMContentLoaded', () => {
  const statusText = document.getElementById('status-text');
  window.electronAPI.onOverlayStatus((statusData) => {
    statusText.textContent = statusData.message;
    if (statusData.status === 'success') {
      statusText.style.color = '#19a65a';
    } else if (statusData.status === 'error') {
      statusText.style.color = '#dc2626';
    } else {
      statusText.style.color = '#222';
    }
  });
});
