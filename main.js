const { app, globalShortcut, Tray, Menu, BrowserWindow, Notification, clipboard } = require('electron');
const { pasteClipboard } = require('./auto_paste');
const Store = require('electron-store');
const Mic = require('mic');
const axios = require('axios');


const path = require('path');
const fs = require('fs');

// Set SoX path globally for both development and production
const isPackaged = process.defaultApp ? false : process.mainModule && process.mainModule.filename.indexOf('app.asar') !== -1;
const basePath = isPackaged ? process.resourcesPath : __dirname;
const soxDir = path.join(basePath, 'bin', 'sox');
process.env.PATH = soxDir + ';' + process.env.PATH;
const soxPath = path.join(soxDir, 'sox.exe');

const store = new Store({
  encryptionKey: 'replace-this-with-a-secure-key', // TODO: Generate/store securely
  schema: {
    apiKey: { type: 'string', default: '' },
    mode: { type: 'string', enum: ['normal', 'email'], default: 'normal' }
  }
});

let tray = null;
let settingsWindow = null;
let overlayWindow = null;
let isRecording = false;
let audioFilePath = path.join(app.getPath('userData'), 'last_recording.wav');
let audioStream = null;
let micInstance = null;

function createTray() {
  if (!tray) {
    tray = new Tray(path.join(__dirname, 'icon.png'));
  }
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Toggle Mode (Current: ' + store.get('mode') + ')',
      click: () => {
        const newMode = store.get('mode') === 'normal' ? 'email' : 'normal';
        store.set('mode', newMode);
        createTray(); // Only update menu, do not create new Tray
      }
    },
    {
      label: 'Settings',
      click: openSettingsWindow
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit()
    }
  ]);
  tray.setToolTip('GeminiWhisper');
  tray.setContextMenu(contextMenu);
}

function openSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 600,
    height: 600,
    resizable: false,
    title: 'GeminiWhisper Settings',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  settingsWindow.loadFile('settings.html');
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

const { screen } = require('electron');
function createOverlay() {
  if (overlayWindow) return;
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  overlayWindow = new BrowserWindow({
    width: 260,
    height: 120,
    x: Math.round(width / 2 - 130),
    y: Math.round(height / 2 - 60),
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    transparent: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  overlayWindow.loadFile('overlay.html');
  overlayWindow.on('closed', () => { overlayWindow = null; });
}

function startRecording() {
  const soxDir = path.join(__dirname, 'bin', 'sox');
  process.env.PATH = soxDir + ';' + process.env.PATH;

  if (isRecording) return;
  isRecording = true;
  micInstance = Mic({
    rate: '16000',
    channels: '1',
    debug: false,
    exitOnSilence: 6,
    soxPath: path.join(__dirname, 'bin', 'sox', 'sox.exe')
  });
  micInputStream = micInstance.getAudioStream();
  audioWriteStream = fs.createWriteStream(audioFilePath);
  micInputStream.pipe(audioWriteStream);
  micInstance.start();
  createOverlay();
  overlayWindow.show();
  overlayWindow.webContents.send('overlay-status', 'Listening...');
}

function stopRecordingAndTranscribe() {
  if (!isRecording) return;
  isRecording = false;
  if (micInstance) {
    micInstance.stop();
    micInstance = null;
  }
  audioWriteStream.end();

  if (overlayWindow) {
    overlayWindow.webContents.send('overlay-status', 'Transcribing...');
  }

  setTimeout(() => {
    processAudio();
  }, 500); // Wait for file write
}

async function processAudio() {
  try {
    const apiKey = store.get('apiKey');
    const mode = store.get('mode');
    if (!apiKey) {
      console.error('API key missing. Please set it in Settings.');
      openSettingsWindow();
      return;
    }
    // Dynamic gain normalization using SoX
    const { execSync } = require('child_process');
    console.log('Using soxPath:', soxPath, 'Exists:', fs.existsSync(soxPath));
    const normalizedPath = path.join(app.getPath('userData'), 'last_recording_normalized.wav');

    // RMS normalization for average speech loudness (no clipping)
    try {
      execSync(`"${soxPath}" "${audioFilePath}" "${normalizedPath}" norm -10`);
    } catch (e) {
      console.error('SoX RMS norm error:', e);
      fs.copyFileSync(audioFilePath, normalizedPath);
    }
    // 4. Use normalized audio for upload
    const audioData = fs.readFileSync(normalizedPath);
    const audioBase64 = audioData.toString('base64');
    let prompt = '';
    if (mode === 'normal') {
      prompt = 'Transcribe the following audio, focusing on clear human speech. If there is background noise, do your best to ignore it, but include all intelligible speech. Only output the transcription. Never write labels like (clap), (hum), or anything describing background noise. If you cannot identify any speech, output exactly %NOSPEECHFOUND%.';
    } else {
      prompt = 'Transcribe the following audio as a professionally written email, including greetings, structure, and tone. Focus on clear human speech, and do your best to ignore background noise. Only output the transcription. Never write labels like (clap), (hum), or anything describing background noise. If you cannot identify any speech, output exactly %NOSPEECHFOUND%.';
    }
    const selectedModel = store.get('model') || 'gemini-2.5-flash-preview-05-20';
    const geminiResponse = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`, {
      contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: 'audio/wav', data: audioBase64 } }] }],
      safetySettings: [{ category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 1 }]
    }, {
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }
    });
    if (geminiResponse.data && geminiResponse.data.candidates && geminiResponse.data.candidates[0].content && geminiResponse.data.candidates[0].content.parts) {
      const text = geminiResponse.data.candidates[0].content.parts.map(p => p.text).join(' ');
      if (text.trim() === '%NOSPEECHFOUND%') {
        if (overlayWindow) {
          overlayWindow.webContents.send('overlay-status', "No speech detected.");
          setTimeout(() => overlayWindow.hide(), 1800);
        }
      } else {
        clipboard.writeText(text);
        pasteClipboard(); // Simulate Ctrl+V to auto-paste transcript
        if (overlayWindow) {
          overlayWindow.webContents.send('overlay-status', 'Copied!');
          setTimeout(() => {
            overlayWindow.hide();
          }, 1200);
        }
      }
    } else {
      if (overlayWindow) {
        overlayWindow.webContents.send('overlay-status', 'No transcription received.');
        setTimeout(() => overlayWindow.hide(), 2000);
      }
      console.error('No transcription received.');
    }
  } catch (err) {
    if (overlayWindow) {
      overlayWindow.webContents.send('overlay-status', 'Error: ' + (err.response?.data?.error?.message || err.message));
      setTimeout(() => overlayWindow.hide(), 2200);
    }
    console.error('Error:', err.response?.data?.error?.message || err.message);
  }
}

function registerHotkey() {
  globalShortcut.unregisterAll();
  const success = globalShortcut.register('Alt+Space', () => {
    console.log('Alt+Space pressed');
    if (!isRecording) {
      startRecording();
    } else {
      stopRecordingAndTranscribe();
    }
  });
  if (success) {
    console.log('Global shortcut Alt+Space registered successfully.');
  } else {
    console.error('Failed to register global shortcut Alt+Space.');
    showNotification('GeminiWhisper', 'Failed to register global shortcut Alt+Space.');
  }
}

app.on('ready', () => {
  console.log('App ready. Creating tray and registering hotkey.');
  createTray();
  registerHotkey();
  app.dock && app.dock.hide && app.dock.hide(); // Hide dock on macOS
});

app.on('window-all-closed', (e) => {
  e.preventDefault(); // Prevent quitting
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// IPC for settings window
const { ipcMain } = require('electron');
ipcMain.handle('get-settings', () => {
  return { apiKey: store.get('apiKey'), mode: store.get('mode') };
});
ipcMain.handle('set-settings', (event, { apiKey, mode }) => {
  if (apiKey !== undefined) store.set('apiKey', apiKey);
  if (mode !== undefined) store.set('mode', mode);
  createTray();
  return true;
});
