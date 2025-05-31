// auto_paste.js
// Simulate Ctrl+V paste using Windows native API (no external dependencies)
// This script is only loaded in packaged Windows builds and called from main.js

const { execFile } = require('child_process');
const path = require('path');

// Use powershell to send Ctrl+V
function pasteClipboard() {
  // Use powershell to send Ctrl+V to the active window
  const psScript = 'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\"^v\")';
  execFile('powershell', ['-Command', psScript], { windowsHide: true }, (error) => {
    if (error) {
      console.error('Auto-paste failed:', error);
    }
  });
}

module.exports = { pasteClipboard };
