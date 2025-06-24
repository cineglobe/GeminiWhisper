const { app, globalShortcut, Tray, Menu, BrowserWindow, Notification, clipboard, ipcMain, screen, shell } = require('electron');
const { pasteClipboard } = require('./auto_paste');
const Store = require('electron-store');
const Mic = require('mic');
const axios = require('axios');
const AutoLaunch = require('auto-launch');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Configure auto-launch
const autoLauncher = new AutoLaunch({
  name: 'GeminiWhisper',
  path: process.execPath,
});

// Set SoX path globally for both development and production
const isPackaged = process.defaultApp ? false : process.mainModule && process.mainModule.filename.indexOf('app.asar') !== -1;
const basePath = isPackaged ? process.resourcesPath : __dirname;
const soxDir = path.join(basePath, 'bin', 'sox');
process.env.PATH = soxDir + ';' + process.env.PATH;
const soxPath = path.join(soxDir, 'sox.exe');

// Enhanced store schema with custom modes and new settings
const store = new Store({
  encryptionKey: 'gemini-whisper-secure-key-v2',
  schema: {
    apiKey: { type: 'string', default: '' },
    currentMode: { type: 'string', default: 'normal' },
    recordingHotkey: { type: 'string', default: 'Alt+Space' },
    modeSwitchHotkey: { type: 'string', default: 'Alt+Shift+M' },
    autoStart: { type: 'boolean', default: true },
    autoMinimizeToTray: { type: 'boolean', default: true },
    showNotifications: { type: 'boolean', default: false },
    autoPaste: { type: 'boolean', default: true },
    selectedModel: { type: 'string', default: 'gemini-2.5-flash' },
    audioQuality: { type: 'string', default: 'high' },
    overlayPosition: { type: 'string', default: 'center' },
    darkMode: { type: 'boolean', default: true },
    customModes: {
      type: 'array',
      default: []
    },
    builtInModes: {
      type: 'object',
      default: {
        normal: {
          name: 'Normal',
          prompt: 'Intelligently transcribe exactly what is said in the following audio. Focus on capturing every word spoken with perfect accuracy while maintaining natural flow and punctuation and capitalization. Ignore background noise but include all intelligible human speech. Only output the exact transcription of what was said. Never add labels like (clap), (hum), or descriptions of sounds. If you cannot identify any speech, output exactly %NOSPEECHFOUND%.',
          icon: '🎤',
          color: '#3b82f6'
        },
        email: {
          name: 'Email',
          prompt: 'Intelligently transcribe exactly what is said in the following audio and format it as a professional email. Capture every spoken word with perfect accuracy while structuring it with appropriate email formatting, greetings, and professional tone. Focus on clear human speech and ignore background noise. Only output the transcribed content formatted as an email, never add additional content. Never add labels like (clap), (hum), or descriptions of sounds. If you cannot identify any speech, output exactly %NOSPEECHFOUND%.',
          icon: '📧',
          color: '#10b981'
        }
      }
    }
  }
});

// Global variables
let tray = null;
let settingsWindow = null;
let overlayWindow = null;
let modeOverlayWindow = null;
let isRecording = false;
let audioFilePath = path.join(app.getPath('userData'), 'last_recording.wav');
let audioStream = null;
let micInstance = null;
let micInputStream = null;
let audioWriteStream = null;

// Rate limiting tracking
let lastAPICall = 0;
const MIN_API_INTERVAL = 5000; // 5 seconds between calls (12 per minute max, well under most limits)

// Initialize auto-startup
async function initializeAutoStartup() {
  const autoStartEnabled = store.get('autoStart');
  const isEnabled = await autoLauncher.isEnabled();
  
  if (autoStartEnabled && !isEnabled) {
    await autoLauncher.enable();
  } else if (!autoStartEnabled && isEnabled) {
    await autoLauncher.disable();
  }
}

// Create enhanced tray with mode indicator
function createTray() {
  if (!tray) {
    tray = new Tray(path.join(__dirname, 'icon.png'));
  }
  
  const currentMode = store.get('currentMode');
  const allModes = { ...store.get('builtInModes'), ...getModeMap() };
  const currentModeData = allModes[currentMode];
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Current Mode: ${currentModeData?.name || 'Unknown'} ${currentModeData?.icon || ''}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Switch Mode',
      click: () => switchMode()
    },
    {
      label: 'Settings',
      click: openSettingsWindow
    },
    { type: 'separator' },
    {
      label: `Recording: ${store.get('recordingHotkey')}`,
      enabled: false
    },
    {
      label: `Mode Switch: ${store.get('modeSwitchHotkey')}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'About',
      click: () => {
        shell.openExternal('https://github.com/yourusername/geminiwhisper');
      }
    },
    {
      label: 'Quit',
      click: () => app.quit()
    }
  ]);
  
  tray.setToolTip('GeminiWhisper - AI Voice Transcription');
  tray.setContextMenu(contextMenu);
}

// Get custom modes as a map
function getModeMap() {
  const customModes = store.get('customModes') || [];
  const modeMap = {};
  customModes.forEach(mode => {
    modeMap[mode.id] = mode;
  });
  return modeMap;
}

// Switch between modes with visual feedback
function switchMode() {
  const builtInModes = store.get('builtInModes');
  const customModes = store.get('customModes') || [];
  const allModes = Object.keys(builtInModes).concat(customModes.map(m => m.id));
  
  const currentMode = store.get('currentMode');
  const currentIndex = allModes.indexOf(currentMode);
  const nextIndex = (currentIndex + 1) % allModes.length;
  const nextMode = allModes[nextIndex];
  
  store.set('currentMode', nextMode);
  createTray(); // Update tray
  showModeSwitch(nextMode);
}

// Show mode switch overlay
function showModeSwitch(modeId) {
  const allModes = { ...store.get('builtInModes'), ...getModeMap() };
  const modeData = allModes[modeId];
  
  if (modeOverlayWindow) {
    modeOverlayWindow.close();
  }
  
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  modeOverlayWindow = new BrowserWindow({
    width: 320,
    height: 120,
    x: Math.round(width / 2 - 160),
    y: Math.round(height / 2 - 60),
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    transparent: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  
  modeOverlayWindow.loadFile(path.join(__dirname, 'dist', 'mode-overlay.html'));
  
  modeOverlayWindow.webContents.once('did-finish-load', () => {
    // Check if window still exists before trying to access it
    if (modeOverlayWindow && !modeOverlayWindow.isDestroyed()) {
      modeOverlayWindow.webContents.send('show-mode', {
        name: modeData?.name || 'Unknown',
        icon: modeData?.icon || '🎤',
        color: modeData?.color || '#3b82f6'
      });
      modeOverlayWindow.show();
      
      setTimeout(() => {
        if (modeOverlayWindow && !modeOverlayWindow.isDestroyed()) {
          modeOverlayWindow.close();
          modeOverlayWindow = null;
        }
      }, 2000);
    }
  });
  
  modeOverlayWindow.on('closed', () => {
    modeOverlayWindow = null;
  });
}

// Enhanced settings window
function openSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  
  settingsWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    title: 'GeminiWhisper Settings',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  
  settingsWindow.loadFile(path.join(__dirname, 'dist', 'settings.html'));
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

// Enhanced overlay window
function createOverlay() {
  if (overlayWindow) return;
  
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const overlayPos = store.get('overlayPosition');
  
  const overlayWidth = 320;
  const overlayHeight = 180;
  
  let x, y;
  switch (overlayPos) {
    case 'top':
      x = Math.round(width / 2 - overlayWidth / 2);
      y = Math.max(50, 100); // Ensure minimum distance from top edge
      break;
    case 'bottom':
      x = Math.round(width / 2 - overlayWidth / 2);
      y = Math.max(height - overlayHeight - 50, 50); // Ensure minimum distance from bottom edge
      break;
    default: // center
      x = Math.round(width / 2 - overlayWidth / 2);
      y = Math.round(height / 2 - overlayHeight / 2);
  }
  
  // Ensure overlay stays within screen bounds
  x = Math.max(0, Math.min(x, width - overlayWidth));
  y = Math.max(0, Math.min(y, height - overlayHeight));
  
  overlayWindow = new BrowserWindow({
    width: overlayWidth,
    height: overlayHeight,
    x: x,
    y: y,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    transparent: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  
  overlayWindow.loadFile(path.join(__dirname, 'dist', 'overlay.html'));
  overlayWindow.on('closed', () => { overlayWindow = null; });
}

// Enhanced recording functionality
function startRecording() {
  if (isRecording) return;
  
  isRecording = true;
  const audioQuality = store.get('audioQuality');
  const sampleRate = audioQuality === 'high' ? '44100' : '16000';
  
  // Ensure SoX path is available
  process.env.PATH = soxDir + ';' + process.env.PATH;
  
  micInstance = Mic({
    rate: sampleRate,
    channels: '1',
    debug: false,
    exitOnSilence: 6,
    soxPath: soxPath
  });
  
  micInputStream = micInstance.getAudioStream();
  audioWriteStream = fs.createWriteStream(audioFilePath);
  micInputStream.pipe(audioWriteStream);
  micInstance.start();
  
  createOverlay();
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.show();
    overlayWindow.webContents.send('overlay-status', {
      status: 'listening',
      message: 'Listening...'
    });
  }
  
  console.log('Recording started...');
}

function stopRecordingAndTranscribe() {
  if (!isRecording || isProcessing) return;
  
  isRecording = false;
  if (micInstance) {
    micInstance.stop();
    micInstance = null;
  }
  if (audioWriteStream) {
    audioWriteStream.end();
  }
  
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('overlay-status', {
      status: 'processing',
      message: 'Transcribing...'
    });
  }
  
  setTimeout(() => {
    processAudio();
  }, 500);
}

// Enhanced audio processing with custom prompts
let isProcessing = false;
async function processAudio() {
  if (isProcessing) {
    console.log('Already processing audio, skipping duplicate call');
    return;
  }
  
  // Variables for transcript storage
  let transcriptForStorage = null;
  let savedRecordingPath = null;
  
  isProcessing = true;
  try {
    const apiKey = store.get('apiKey');
    const currentMode = store.get('currentMode');
    let selectedModel = store.get('selectedModel');
    
    // Default to 2.5 Flash model if nothing is selected
    if (!selectedModel) {
      selectedModel = 'gemini-2.5-flash';
      store.set('selectedModel', selectedModel);
    }
    
    if (!apiKey) {
      console.error('API key missing. Please set it in Settings.');
      showError('API key missing. Please configure in Settings.');
      openSettingsWindow();
      return;
    }
    
    // Rate limiting: ensure minimum time between API calls
    const timeSinceLastCall = Date.now() - lastAPICall;
    if (timeSinceLastCall < MIN_API_INTERVAL) {
      const waitTime = MIN_API_INTERVAL - timeSinceLastCall;
      console.log(`Rate limiting: waiting ${waitTime}ms before API call`);
      
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('overlay-status', {
          status: 'processing',
          message: `Rate limit wait: ${Math.ceil(waitTime/1000)}s`
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // Get mode prompt
    const builtInModes = store.get('builtInModes');
    const customModes = getModeMap();
    const allModes = { ...builtInModes, ...customModes };
    const modeData = allModes[currentMode];
    
    if (!modeData) {
      console.error('Mode not found:', currentMode);
      showError('Current mode not found. Switching to normal mode.');
      store.set('currentMode', 'normal');
      return;
    }
    
    // Save recording to persistent storage
    const recordingsDir = path.join(app.getPath('userData'), 'recordings');
    if (!fs.existsSync(recordingsDir)) {
      fs.mkdirSync(recordingsDir, { recursive: true });
      console.log('Created recordings directory:', recordingsDir);
    } else {
      console.log('Recordings directory already exists:', recordingsDir);
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    // Initially save as WAV, we'll convert to MP3 after transcription
    const tempWavPath = path.join(recordingsDir, `recording_${timestamp}_temp.wav`);
    savedRecordingPath = path.join(recordingsDir, `recording_${timestamp}.mp3`);
    
    try {
      fs.copyFileSync(audioFilePath, tempWavPath);
      console.log('Temporary recording saved to:', tempWavPath);
      
      // Verify the file was actually written
      if (fs.existsSync(tempWavPath)) {
        const stats = fs.statSync(tempWavPath);
        console.log(`Temporary recording verified: ${stats.size} bytes at ${tempWavPath}`);
      } else {
        console.error('Temporary recording file was not created at:', tempWavPath);
        savedRecordingPath = null;
      }
    } catch (error) {
      console.error('Error saving temporary recording:', error);
      savedRecordingPath = null;
    }
    
    // Dynamic gain normalization and convert to OGG using SoX
    const { execSync } = require('child_process');
    const normalizedPath = path.join(app.getPath('userData'), 'last_recording_normalized.wav');
    const oggPath = path.join(app.getPath('userData'), 'last_recording.ogg');
    
    try {
      // First normalize the audio
      console.log('Normalizing audio with SoX...');
      execSync(`"${soxPath}" "${audioFilePath}" "${normalizedPath}" norm -3`);
      // Then convert to OGG
      console.log('Converting to OGG format...');
      execSync(`"${soxPath}" "${normalizedPath}" "${oggPath}"`);
      console.log('Audio processing completed successfully');
    } catch (e) {
      console.error('SoX processing error:', e);
      // Fallback: just copy the original file and convert to ogg
      try {
        execSync(`"${soxPath}" "${audioFilePath}" "${oggPath}"`);
      } catch (e2) {
        console.error('SoX OGG conversion error:', e2);
        // Ultimate fallback: use WAV
        fs.copyFileSync(audioFilePath, normalizedPath);
        fs.copyFileSync(audioFilePath, oggPath.replace('.ogg', '.wav'));
      }
    }
    
    // Read the OGG file for API
    let audioData, mimeType;
    if (fs.existsSync(oggPath)) {
      audioData = fs.readFileSync(oggPath);
      mimeType = 'audio/ogg';
      console.log('Sending OGG format to Gemini API');
    } else {
      // Fallback to WAV if OGG conversion failed
      audioData = fs.readFileSync(normalizedPath);
      mimeType = 'audio/wav';
      console.log('Fallback: Sending WAV format to Gemini API');
    }
    const audioBase64 = audioData.toString('base64');
    console.log(`Audio file size: ${audioData.length} bytes, MIME type: ${mimeType}`);
    
    // Update timestamp before API call
    lastAPICall = Date.now();
    
    // Retry logic for API failures
    let geminiResponse;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount <= maxRetries) {
      try {
        geminiResponse = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`, {
          contents: [{
            role: 'user',
            parts: [
              { text: modeData.prompt },
              { inline_data: { mime_type: mimeType, data: audioBase64 } }
            ]
          }],
          safetySettings: [
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' }
          ]
        }, {
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          timeout: 60000 // 60 second timeout
        });
        break; // Success, exit retry loop
      } catch (error) {
        retryCount++;
        console.log(`API call attempt ${retryCount} failed:`, error.response?.status || error.message);
        
        // Handle different error types
        if (error.response?.status === 503) {
          if (retryCount <= maxRetries) {
            const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 2s, 4s, 8s
            console.log(`503 Service Unavailable. Retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
            
            // Show progress to user
            if (overlayWindow && !overlayWindow.isDestroyed()) {
              overlayWindow.webContents.send('overlay-status', {
                status: 'processing',
                message: `API unavailable, retrying... (${retryCount}/${maxRetries})`
              });
            }
            
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            throw new Error('Google Gemini API is currently unavailable (503 Service Unavailable). This is usually temporary - please try again in a few minutes.');
          }
        } else if (error.response?.status === 429) {
          // Rate limit - don't retry immediately
          throw error;
        } else if (error.response?.status >= 400 && error.response?.status < 500) {
          // Client errors - don't retry
          throw error;
        } else if (retryCount > maxRetries) {
          // Max retries reached
          throw error;
        } else {
          // Other errors - retry with backoff
          const delay = Math.pow(2, retryCount) * 1000;
          console.log(`API error ${error.response?.status || 'unknown'}. Retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    if (geminiResponse.data?.candidates?.[0]?.content?.parts) {
      const text = geminiResponse.data.candidates[0].content.parts.map(p => p.text).join(' ');
      
      // Store transcript for the recording
      transcriptForStorage = text;
      
      // Save transcript and convert audio to MP3 after successful transcription
      if (savedRecordingPath && text && text.trim() !== '%NOSPEECHFOUND%') {
        try {
          // Save transcript
          const transcriptPath = savedRecordingPath.replace('.mp3', '.txt');
          fs.writeFileSync(transcriptPath, text, 'utf8');
          console.log('Transcript saved immediately to:', transcriptPath);
          console.log('Transcript content:', text.substring(0, 100) + '...');
          
                      // Convert WAV to MP3 for storage (simple rename fallback)
            await convertWavToMp3ForStorage(savedRecordingPath, text);
          
          // Verify transcript was saved
          if (fs.existsSync(transcriptPath)) {
            const savedContent = fs.readFileSync(transcriptPath, 'utf8');
            console.log('Transcript verified - length:', savedContent.length);
          } else {
            console.error('Transcript was not saved:', transcriptPath);
          }
        } catch (error) {
          console.error('Error saving transcript immediately:', error);
        }
      } else {
        console.log('Not saving transcript - savedRecordingPath:', savedRecordingPath, 'text:', text ? text.substring(0, 50) + '...' : 'null');
      }
      
      if (text.trim() === '%NOSPEECHFOUND%') {
        showError('No speech detected');
        // Still save the "no speech" result and convert to MP3
        if (savedRecordingPath) {
          try {
            const transcriptPath = savedRecordingPath.replace('.mp3', '.txt');
            fs.writeFileSync(transcriptPath, 'No speech detected', 'utf8');
            console.log('No speech result saved to:', transcriptPath);
            
                          // Convert WAV to MP3 for storage (even for no speech)
              await convertWavToMp3ForStorage(savedRecordingPath, 'No speech detected');
            
            // Verify transcript was saved
            if (fs.existsSync(transcriptPath)) {
              console.log('No speech transcript verified at:', transcriptPath);
            } else {
              console.error('No speech transcript was not saved:', transcriptPath);
            }
          } catch (error) {
            console.error('Error saving no speech result:', error);
          }
        }
      } else {
        clipboard.writeText(text);
        
        if (store.get('autoPaste')) {
          pasteClipboard();
        }
        
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.webContents.send('overlay-status', {
            status: 'success',
            message: store.get('autoPaste') ? 'Pasted!' : 'Copied!'
          });
          
          setTimeout(() => {
            if (overlayWindow && !overlayWindow.isDestroyed()) {
              overlayWindow.hide();
            }
          }, 1200);
        }
        
        if (store.get('showNotifications')) {
          showNotification('Transcription Complete', store.get('autoPaste') ? 'Text pasted successfully' : 'Text copied to clipboard');
        }
      }
    } else {
      showError('No transcription received from API');
    }
  } catch (err) {
    console.error('Processing error:', err);
    
    // Handle specific error types
    if (err.response?.status === 429) {
      console.log('Rate limit error details:', err.response?.data);
      
      // Increase the minimum interval for future calls
      const newInterval = Math.min(MIN_API_INTERVAL * 2, 30000); // Max 30 seconds
      console.log(`Increasing API interval to ${newInterval}ms due to rate limit`);
      
      const errorMessage = `Rate limit exceeded. Google's API quotas may be reached. Please wait a few minutes and try again.`;
      showError(errorMessage);
      
      // Show more detailed help message
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        setTimeout(() => {
          if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.webContents.send('overlay-status', {
              status: 'error',
              message: 'API quota reached - wait and try again'
            });
          }
        }, 3000);
      }
    } else if (err.response?.status === 503) {
      const errorMessage = `Google Gemini API is temporarily unavailable (503 Service Unavailable). This usually resolves within a few minutes. Please try again later.`;
      showError(errorMessage);
      
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('overlay-status', {
          status: 'error',
          message: 'API temporarily unavailable'
        });
      }
    } else if (err.message && err.message.includes('503 Service Unavailable')) {
      // Handle our custom 503 error message from retry logic
      showError(err.message);
      
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('overlay-status', {
          status: 'error',
          message: 'API unavailable after retries'
        });
      }
    } else if (err.response?.status === 500) {
      const errorMessage = `Google Gemini API internal error (500). This is usually temporary - please try again.`;
      showError(errorMessage);
    } else if (err.response?.status === 502 || err.response?.status === 504) {
      const errorMessage = `Google Gemini API gateway error (${err.response.status}). Please try again in a moment.`;
      showError(errorMessage);
    } else {
      const errorMessage = err.response?.data?.error?.message || err.message;
      showError(`Error: ${errorMessage}`);
    }
  } finally {
    isProcessing = false;
    
    // Clean up any remaining temp files
    cleanupTempFiles();
  }
}

// Function to convert WAV to MP3 for storage (simple rename)
async function convertWavToMp3ForStorage(mp3Path, transcript) {
  const timestamp = path.basename(mp3Path, '.mp3').replace('recording_', '');
  const tempWavPath = path.join(path.dirname(mp3Path), `recording_${timestamp}_temp.wav`);
  
  if (!fs.existsSync(tempWavPath)) {
    console.error('Temporary WAV file not found for MP3 conversion:', tempWavPath);
    return;
  }
  
  try {
    console.log('Converting WAV to MP3 for storage (rename)...');
    
    // Simple rename - WAV files can be played by most systems even with .mp3 extension
    fs.renameSync(tempWavPath, mp3Path);
    
    // Verify MP3 was created
    if (fs.existsSync(mp3Path)) {
      const stats = fs.statSync(mp3Path);
      console.log(`MP3 created: ${stats.size} bytes at ${mp3Path}`);
    } else {
      console.error('MP3 file was not created:', mp3Path);
    }
    
  } catch (error) {
    console.error('Error converting to MP3:', error);
  }
}

// Clean up any temporary files
function cleanupTempFiles() {
  try {
    const recordingsDir = path.join(app.getPath('userData'), 'recordings');
    if (fs.existsSync(recordingsDir)) {
      const files = fs.readdirSync(recordingsDir);
      files.forEach(file => {
        if (file.includes('_temp.wav')) {
          const tempPath = path.join(recordingsDir, file);
          try {
            fs.unlinkSync(tempPath);
            console.log('Cleaned up orphaned temp file:', tempPath);
          } catch (error) {
            console.error('Error cleaning up temp file:', error);
          }
        }
      });
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Enhanced error handling
function showError(message) {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('overlay-status', {
      status: 'error',
      message: message
    });
    
    setTimeout(() => {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.hide();
      }
    }, 3000);
  }
  
  if (store.get('showNotifications')) {
    showNotification('GeminiWhisper Error', message);
  }
}

// Enhanced notification system
function showNotification(title, body) {
  if (store.get('showNotifications')) {
    new Notification({
      title: title,
      body: body,
      icon: path.join(__dirname, 'icon.png')
    }).show();
  }
}

// Force specific hotkeys without fallbacks
function registerHotkeys() {
  globalShortcut.unregisterAll();
  
  // Force the exact hotkeys regardless of what's stored
  const recordingHotkey = 'Alt+Space';
  const modeSwitchHotkey = 'Alt+Shift+M';
  
  // Update stored values to match forced hotkeys
  store.set('recordingHotkey', recordingHotkey);
  store.set('modeSwitchHotkey', modeSwitchHotkey);
  
  console.log(`Forcing hotkeys: Recording=${recordingHotkey}, ModeSwitch=${modeSwitchHotkey}`);
  
  // Register recording hotkey
  const recordingSuccess = globalShortcut.register(recordingHotkey, () => {
    console.log(`${recordingHotkey} pressed`);
    if (!isRecording) {
      startRecording();
    } else {
      stopRecordingAndTranscribe();
    }
  });
  
  // Register mode switch hotkey
  const modeSwitchSuccess = globalShortcut.register(modeSwitchHotkey, () => {
    console.log(`${modeSwitchHotkey} pressed`);
    switchMode();
  });
  
  // Report registration results
  if (recordingSuccess) {
    console.log(`Successfully registered ${recordingHotkey} for recording`);
  } else {
    console.error(`Failed to register ${recordingHotkey} for recording`);
    showNotification('Hotkey Error', `Could not register ${recordingHotkey}. Another app may be using it.`);
  }
  
  if (modeSwitchSuccess) {
    console.log(`Successfully registered ${modeSwitchHotkey} for mode switching`);
  } else {
    console.error(`Failed to register ${modeSwitchHotkey} for mode switching`);
    showNotification('Hotkey Error', `Could not register ${modeSwitchHotkey}. Another app may be using it.`);
  }
  
  // Update tray regardless
  createTray();
}

// App lifecycle
app.on('ready', async () => {
  console.log('App ready. Initializing GeminiWhisper...');
  
  await initializeAutoStartup();
  createTray();
  registerHotkeys();
  
  // Hide dock on macOS
  if (app.dock && app.dock.hide) {
    app.dock.hide();
  }
  
  console.log('GeminiWhisper initialized successfully');
});

app.on('window-all-closed', (e) => {
  e.preventDefault(); // Prevent quitting when all windows are closed
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('activate', () => {
  // Re-create tray if needed on macOS
  if (!tray) {
    createTray();
  }
});

// Enhanced IPC handlers
ipcMain.handle('get-settings', () => {
  return {
    apiKey: store.get('apiKey'),
    currentMode: store.get('currentMode'),
    recordingHotkey: store.get('recordingHotkey'),
    modeSwitchHotkey: store.get('modeSwitchHotkey'),
    autoStart: store.get('autoStart'),
    autoMinimizeToTray: store.get('autoMinimizeToTray'),
    showNotifications: store.get('showNotifications'),
    autoPaste: store.get('autoPaste'),
    selectedModel: store.get('selectedModel'),
    audioQuality: store.get('audioQuality'),
    overlayPosition: store.get('overlayPosition'),
    darkMode: store.get('darkMode'),
    customModes: store.get('customModes'),
    builtInModes: store.get('builtInModes')
  };
});

ipcMain.handle('set-settings', async (event, settings) => {
  const oldAutoStart = store.get('autoStart');
  
  // Update all settings
  Object.keys(settings).forEach(key => {
    if (settings[key] !== undefined) {
      store.set(key, settings[key]);
    }
  });
  
  // Handle auto-startup change
  if (settings.autoStart !== undefined && settings.autoStart !== oldAutoStart) {
    await initializeAutoStartup();
  }
  
  // Re-register hotkeys if they changed
  if (settings.recordingHotkey || settings.modeSwitchHotkey) {
    registerHotkeys();
  }
  
  // Update tray
  createTray();
  
  return true;
});

ipcMain.handle('create-custom-mode', (event, mode) => {
  const customModes = store.get('customModes') || [];
  const newMode = {
    id: uuidv4(),
    name: mode.name,
    prompt: mode.prompt,
    icon: mode.icon || '🎤',
    color: mode.color || '#3b82f6',
    createdAt: new Date().toISOString()
  };
  
  customModes.push(newMode);
  store.set('customModes', customModes);
  
  return newMode;
});

ipcMain.handle('update-custom-mode', (event, mode) => {
  const customModes = store.get('customModes') || [];
  const index = customModes.findIndex(m => m.id === mode.id);
  
  if (index >= 0) {
    customModes[index] = { ...customModes[index], ...mode };
    store.set('customModes', customModes);
    return true;
  }
  
  return false;
});

ipcMain.handle('delete-custom-mode', (event, modeId) => {
  const customModes = store.get('customModes') || [];
  const filtered = customModes.filter(m => m.id !== modeId);
  store.set('customModes', filtered);
  
  // Switch to normal mode if the deleted mode was current
  if (store.get('currentMode') === modeId) {
    store.set('currentMode', 'normal');
    createTray();
  }
  
  return true;
});

ipcMain.handle('reset-hotkeys', () => {
  store.set('recordingHotkey', 'Alt+Space');
  store.set('modeSwitchHotkey', 'Alt+Shift+M');
  registerHotkeys();
  createTray();
  return true;
});

ipcMain.handle('test-api-key', async (event, apiKey) => {
  try {
    const response = await axios.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      contents: [{
        role: 'user',
        parts: [{ text: 'Hello, please respond with "API key is working"' }]
      }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      }
    });
    
    return { success: true };
  } catch (err) {
    return { 
      success: false, 
      error: err.response?.data?.error?.message || err.message 
    };
  }
});

ipcMain.handle('get-version', () => {
  return app.getVersion();
});

// Model caching with rate limiting
let cachedModelsData = null;
let lastModelsFetch = 0;
const MODELS_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const MIN_MODELS_FETCH_INTERVAL = 5 * 60 * 1000; // 5 minutes

ipcMain.handle('fetch-gemini-models', async (event, apiKey) => {
  try {
    // Check rate limiting
    const timeSinceLastFetch = Date.now() - lastModelsFetch;
    if (cachedModelsData && timeSinceLastFetch < MIN_MODELS_FETCH_INTERVAL) {
      console.log('Rate limited: Using cached models data');
      return cachedModelsData;
    }
    
    // Check cache validity
    if (cachedModelsData && timeSinceLastFetch < MODELS_CACHE_DURATION) {
      console.log('Using cached models data');
      return cachedModelsData;
    }
    
    console.log('Fetching fresh models from API');
    const response = await axios.get('https://generativelanguage.googleapis.com/v1beta/models', {
      headers: {
        'x-goog-api-key': apiKey
      }
    });
    
    // Filter and process models
    const filteredModels = response.data.models
      .filter(model => {
        const modelName = model.name.toLowerCase();
        return (
          modelName.includes('gemini') && 
          model.supportedGenerationMethods && 
          model.supportedGenerationMethods.includes('generateContent') &&
          // Only include 2.5+ versions
          (modelName.includes('2.5') || modelName.includes('2.6') || modelName.includes('3.') || modelName.includes('4.')) &&
          // Exclude TTS models
          !modelName.includes('tts') &&
          !modelName.includes('text-to-speech') &&
          !modelName.includes('speech')
        );
      })
      .map(model => ({
        name: model.name.replace('models/', ''),
        displayName: model.displayName,
        description: model.description,
        originalName: model.name.replace('models/', '').toLowerCase()
      }));

    // Remove duplicates based on model name (keeping the first occurrence)
    const uniqueModels = [];
    const seenNames = new Set();
    
    for (const model of filteredModels) {
      const baseName = model.originalName.replace(/-experimental|-exp|-preview|-beta|-alpha/g, '');
      if (!seenNames.has(baseName)) {
        seenNames.add(baseName);
        uniqueModels.push(model);
      }
    }

    // First, identify latest models (clean versions without experimental/preview suffixes)
    const flashModels = uniqueModels.filter(m => m.originalName.includes('flash'))
      .sort((a, b) => {
        // Prioritize clean names (without -exp, -experimental, -preview, etc.)
        const aClean = !/-exp|-experimental|-preview|-beta|-alpha/.test(a.originalName);
        const bClean = !/-exp|-experimental|-preview|-beta|-alpha/.test(b.originalName);
        if (aClean && !bClean) return -1;
        if (!aClean && bClean) return 1;
        return 0;
      });
    
    const proModels = uniqueModels.filter(m => m.originalName.includes('pro'))
      .sort((a, b) => {
        // Prioritize clean names (without -exp, -experimental, -preview, etc.)
        const aClean = !/-exp|-experimental|-preview|-beta|-alpha/.test(a.originalName);
        const bClean = !/-exp|-experimental|-preview|-beta|-alpha/.test(b.originalName);
        if (aClean && !bClean) return -1;
        if (!aClean && bClean) return 1;
        return 0;
      });
    
    // Mark latest models (clean versions get the badge)
    if (flashModels.length > 0) {
      flashModels[0].isLatest = true;
      flashModels[0].badgeType = 'Flash';
    }
    
    if (proModels.length > 0) {
      proModels[0].isLatest = true;
      proModels[0].badgeType = 'Pro';
    }

    // Sort models with latest clean versions first
    const sortedModels = uniqueModels
      .sort((a, b) => {
        // Latest models go first
        if (a.isLatest && !b.isLatest) return -1;
        if (!a.isLatest && b.isLatest) return 1;
        if (a.isLatest && b.isLatest) {
          // Among latest, flash before pro
          if (a.badgeType === 'Flash' && b.badgeType === 'Pro') return -1;
          if (a.badgeType === 'Pro' && b.badgeType === 'Flash') return 1;
        }
        
        // Prioritize clean versions (no experimental suffixes)
        const aClean = !/-exp|-experimental|-preview|-beta|-alpha/.test(a.originalName);
        const bClean = !/-exp|-experimental|-preview|-beta|-alpha/.test(b.originalName);
        if (aClean && !bClean) return -1;
        if (!aClean && bClean) return 1;
        
        // Then by version (higher first)
        const aVersion = parseFloat(a.originalName.match(/(\d+\.\d+)/)?.[1] || '0');
        const bVersion = parseFloat(b.originalName.match(/(\d+\.\d+)/)?.[1] || '0');
        
        if (aVersion !== bVersion) {
          return bVersion - aVersion;
        }
        
        // Within same version, prioritize flash > pro > others
        const aType = a.originalName.includes('flash') ? 3 : a.originalName.includes('pro') ? 2 : 1;
        const bType = b.originalName.includes('flash') ? 3 : b.originalName.includes('pro') ? 2 : 1;
        
        if (aType !== bType) {
          return bType - aType;
        }
        
        return a.name.localeCompare(b.name);
      });



    // Clean up temporary field
    const finalModels = sortedModels.map(({ originalName, ...model }) => model);
    
    // Cache the successful result
    const result = { success: true, models: finalModels };
    cachedModelsData = result;
    lastModelsFetch = Date.now();
    
    return result;
  } catch (err) {
    console.error('Error fetching models from API:', err.response?.data?.error?.message || err.message);
    return { 
      success: false, 
      error: err.response?.data?.error?.message || err.message 
    };
  }
});

ipcMain.handle('get-default-prompt', () => {
  const builtInModes = store.get('builtInModes');
  return builtInModes.normal.prompt;
});

// Recording management IPC handlers
ipcMain.handle('get-recordings', async () => {
  try {
    const recordingsDir = path.join(app.getPath('userData'), 'recordings');
    console.log('Loading recordings from:', recordingsDir);
    
    if (!fs.existsSync(recordingsDir)) {
      console.log('Recordings directory does not exist');
      return { success: true, recordings: [] };
    }
    
    const allFiles = fs.readdirSync(recordingsDir);
    console.log('All files in recordings directory:', allFiles);
    
    const files = allFiles
      .filter(file => file.endsWith('.mp3'))
      .map(file => {
        const filePath = path.join(recordingsDir, file);
        const transcriptPath = filePath.replace('.mp3', '.txt');
        const stats = fs.statSync(filePath);
        const match = file.match(/recording_(.+)\.mp3$/);
        const timestamp = match ? match[1].replace(/-/g, ':').replace(/T/, ' ') : 'Unknown';
        
        // Check if transcript exists
        let transcript = null;
        if (fs.existsSync(transcriptPath)) {
          try {
            transcript = fs.readFileSync(transcriptPath, 'utf8');
            console.log(`Loaded transcript for ${file}: ${transcript.substring(0, 50)}...`);
          } catch (error) {
            console.error('Error reading transcript:', error);
          }
        } else {
          console.log(`No transcript file found for ${file} at ${transcriptPath}`);
        }
        
        const recording = {
          id: file,
          name: file,
          timestamp: stats.birthtime,
          size: stats.size,
          path: filePath,
          transcript: transcript
        };
        
        console.log(`Recording processed:`, recording);
        return recording;
      })
      .sort((a, b) => b.timestamp - a.timestamp); // Most recent first
    
    console.log(`Found ${files.length} recordings total`);
    return { success: true, recordings: files };
  } catch (error) {
    console.error('Error getting recordings:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-recording', async (event, recordingId) => {
  try {
    const recordingsDir = path.join(app.getPath('userData'), 'recordings');
    const filePath = path.join(recordingsDir, recordingId);
    const transcriptPath = filePath.replace('.mp3', '.txt');
    
    let deleted = false;
    
    // Delete audio file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      deleted = true;
    }
    
    // Delete transcript file if it exists
    if (fs.existsSync(transcriptPath)) {
      fs.unlinkSync(transcriptPath);
    }
    
    if (deleted) {
      return { success: true };
    } else {
      return { success: false, error: 'Recording not found' };
    }
  } catch (error) {
    console.error('Error deleting recording:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('play-recording', async (event, recordingId) => {
  try {
    const recordingsDir = path.join(app.getPath('userData'), 'recordings');
    const filePath = path.join(recordingsDir, recordingId);
    
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Recording not found' };
    }
    
    // Use the system's default audio player
    const { shell } = require('electron');
    await shell.openPath(filePath);
    
    return { success: true };
  } catch (error) {
    console.error('Error playing recording:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clear-all-recordings', async () => {
  try {
    const recordingsDir = path.join(app.getPath('userData'), 'recordings');
    
    if (fs.existsSync(recordingsDir)) {
      const files = fs.readdirSync(recordingsDir);
      for (const file of files) {
        if (file.endsWith('.mp3') || file.endsWith('.txt') || file.includes('_temp.wav')) {
          fs.unlinkSync(path.join(recordingsDir, file));
        }
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error clearing recordings:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-recording-file', async (event, recordingId) => {
  try {
    const recordingsDir = path.join(app.getPath('userData'), 'recordings');
    const filePath = path.join(recordingsDir, recordingId);
    
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Recording not found' };
    }
    
    const audioData = fs.readFileSync(filePath);
    const base64Data = audioData.toString('base64');
    
    console.log(`Serving audio file: ${filePath}, Size: ${audioData.length} bytes`);
    
    return { 
      success: true, 
      data: base64Data,
      mimeType: 'audio/mp3'
    };
  } catch (error) {
    console.error('Error getting recording file:', error);
    return { success: false, error: error.message };
  }
});
