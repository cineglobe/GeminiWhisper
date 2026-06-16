# GeminiWhisper

Modern AI-powered voice transcription for Windows, built with Electron, SoX, and the Google Gemini API.

![Version](https://img.shields.io/badge/Version-2.1.0-blue.svg) ![Platform](https://img.shields.io/badge/Platform-Windows-lightgrey.svg) ![License](https://img.shields.io/badge/License-MIT-green.svg)

GeminiWhisper records speech with a global hotkey, sends the audio to Gemini for transcription, and copies or pastes the result into the active app. It is designed for people who want a lightweight, very secure, local-first alternative to paid dictation tools while keeping their API key and recordings on their own machine.

## Used by

GeminiWhisper is used by the University of Kent and EKC Group Canterbury College.

## Features

- Global recording hotkey: press `Alt+Space` to start and stop recording
- Automatic clipboard copy and optional auto-paste into the active app
- Gemini model selection with Gemini 3.5 Flash as the default
- Built-in transcription modes for plain text and professional email formatting
- Local recording archive with transcript sidecar files
- Audio normalization through bundled SoX
- System tray controls, launch-at-login support, and recording overlay feedback
- API key test flow and model refresh in settings

## Current Model Support

GeminiWhisper defaults to `gemini-3.5-flash`, with fallbacks for:

- `gemini-flash-latest`
- `gemini-3.1-pro-preview`
- `gemini-2.5-flash`
- `gemini-2.5-pro`
- `gemini-2.5-flash-lite`

Older saved settings for deprecated preview models are migrated automatically to current stable equivalents.

## Quick Start

### Prerequisites

- Windows 10 or 11
- Node.js 18+
- A Google Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

### Install from Release

1. Download the latest installer from [GitHub Releases](https://github.com/cineglobe/GeminiWhisper/releases).
2. Run the installer.
3. Open GeminiWhisper from the Start Menu.
4. Add your Gemini API key in Settings.

### Run from Source

```bash
git clone https://github.com/cineglobe/GeminiWhisper.git
cd GeminiWhisper
npm install
npm run dev
```

### Build for Windows

```bash
npm run dist
```

Build output is written to `release/`.

## Usage

1. Open GeminiWhisper. It runs from the system tray.
2. Right-click the tray icon and open Settings.
3. Paste your Gemini API key and choose a model.
4. Press `Alt+Space` to start recording.
5. Press `Alt+Space` again to stop and transcribe.
6. The transcript is copied to the clipboard or pasted automatically, depending on settings.

## Transcription Modes

### Normal

Accurate speech-to-text transcription with punctuation and capitalization.

### Email

Transcribes speech and formats it as a professional email.

The app also has internal support for custom prompt modes. The next maintenance target is exposing full custom-mode editing in the refreshed settings UI.

## Security and Privacy

GeminiWhisper is built to be very secure and local-first by default.

- API keys are stored locally using `electron-store` encryption.
- Audio is sent only to the configured Google Gemini API endpoint for transcription.
- GeminiWhisper does not include telemetry.
- Recordings and transcripts are saved locally under the app user-data directory.
- Temporary audio processing files are cleaned up after transcription.
- See [SECURITY.md](SECURITY.md) for the security policy and vulnerability reporting process.

## Project Structure

```text
GeminiWhisper/
├── main.js              # Electron main process, recording, Gemini API, tray, IPC
├── preload.js           # Secure renderer bridge
├── settings.html        # Settings UI
├── settings.js          # Settings UI logic
├── overlay.html         # Recording overlay
├── overlay.js           # Recording overlay logic
├── mode-overlay.html    # Mode switch overlay
├── mode-overlay.js      # Mode switch overlay logic
├── auto_paste.js        # Clipboard paste automation
├── package.json         # App metadata and build config
└── bin/sox/             # Bundled SoX binaries in packaged builds
```

## Maintenance Notes

### Version 2.1.0

- Updated default transcription model to Gemini 3.5 Flash.
- Added current Gemini model options and bundled model fallback list.
- Added migration from older Gemini 2.0 and 2.5 preview model settings.
- Fixed source checkout UI loading when `dist/` is not present.
- Rebuilt Settings to use the secure preload API with model refresh and API-key testing.
- Added the missing mode-switch overlay files used by the main process.
- Fixed recording archives to use `.wav` for actual WAV audio instead of mislabeled `.mp3` files.
- Upgraded packaging to Electron 42.4.0 and electron-builder 26.15.3.
- Updated repository links and removed placeholder documentation.

### Version 2.0.0

- Added custom transcription mode storage.
- Added recording overlay and mode-switch feedback.
- Added settings for model choice, audio quality, notifications, and auto-paste.
- Added local recording and transcript history.

## Development

```bash
npm install
npm run dev
```

Useful checks:

```bash
node --check main.js
node --check preload.js
node --check settings.js
node --check overlay.js
node --check mode-overlay.js
```

## License

MIT License. See [LICENSE](LICENSE).

## Links

- [Repository](https://github.com/cineglobe/GeminiWhisper)
- [Releases](https://github.com/cineglobe/GeminiWhisper/releases)
- [Issues](https://github.com/cineglobe/GeminiWhisper/issues)
- [Google AI Studio](https://aistudio.google.com/)
