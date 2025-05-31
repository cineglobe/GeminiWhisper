# GeminiWhisper

A production-ready Electron app that:
- Listens for a global hotkey (ALT + SPACE) to record audio
- Sends audio to Google Gemini for transcription (Normal or Email mode)
- Pastes the result into the active text field
- Runs in the background with a tray icon and settings menu

## Features
- Securely stores Gemini API key
- Toggle between Normal and Email transcription modes
- System tray controls
- Runs silently in background

## Usage
1. Install dependencies: `npm install`
2. Start the app: `npm start`

## Security
- API keys are stored securely and only sent to Gemini
- No data is sent to third parties

## Platform
- Windows (tested)

---
