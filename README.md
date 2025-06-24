# 🎤 GeminiWhisper

> **Modern AI-powered voice transcription app with custom modes and beautiful UI**

GeminiWhisper is a powerful, free alternative to SuperWhisper for Windows, offering AI-powered voice transcription with Google's Gemini API. Record audio with a simple hotkey, get instant transcriptions, and automatically paste the results anywhere you need them.

![GeminiWhisper Preview](https://img.shields.io/badge/Version-2.0.0-blue.svg) ![Platform](https://img.shields.io/badge/Platform-Windows-lightgrey.svg) ![License](https://img.shields.io/badge/License-MIT-green.svg)

## ✨ Features

### 🎯 Core Functionality
- **Instant Voice Transcription**: Record audio with `Alt+Space` and get AI-powered transcriptions
- **Auto-Paste**: Automatically paste transcribed text to your current application
- **System Tray Integration**: Runs quietly in the background, always ready when you need it

### 🎨 Modern Interface
- **Beautiful Recording Overlay**: Modern, animated overlay with smooth transitions
- **Enhanced Settings Panel**: Comprehensive settings with tabbed interface
- **Mode Switch Indicator**: Visual feedback when switching between transcription modes
- **Dark Mode Support**: Automatically adapts to your system theme

### 🔧 Advanced Features
- **Custom Transcription Modes**: Create unlimited custom modes with personalized AI prompts
- **Built-in Modes**: Pre-configured Normal and Email modes with editable prompts
- **Customizable Hotkeys**: Set your own shortcuts for recording and mode switching
- **Auto-Startup**: Optional startup with Windows
- **High-Quality Audio**: Configurable audio quality (16kHz or 44.1kHz)
- **Flexible Overlay Positioning**: Choose where the recording overlay appears

## 🚀 Quick Start

### Prerequisites
- Windows 10/11
- Google Gemini API key ([Get it here](https://aistudio.google.com/app/apikey))

### Installation

#### Option 1: Download Release (Recommended)
1. Download the latest release from the [Releases page](https://github.com/yourusername/geminiwhisper/releases)
2. Run the installer
3. Launch GeminiWhisper from the Start Menu or desktop shortcut

#### Option 2: Build from Source
```bash
# Clone the repository
git clone https://github.com/yourusername/geminiwhisper.git
cd geminiwhisper

# Install dependencies
npm install

# Start development
npm run dev

# Build for production
npm run dist
```

### Initial Setup
1. **Get API Key**: Visit [Google AI Studio](https://aistudio.google.com/app/apikey) to create a free Gemini API key
2. **Configure GeminiWhisper**: 
   - Right-click the system tray icon
   - Select "Settings"
   - Enter your API key and configure preferences
3. **Test the API**: Use the "Test Key" button to verify your API key works
4. **Start Recording**: Press `Alt+Space` to start recording, speak, then press `Alt+Space` again to transcribe

## 📖 Usage Guide

### Basic Usage
1. **Start Recording**: Press `Alt+Space` (or your custom hotkey)
2. **Speak Clearly**: The overlay will show "Listening..." with a pulsing animation
3. **Stop Recording**: Press `Alt+Space` again
4. **Get Results**: Text is automatically transcribed and pasted where your cursor is

### Transcription Modes

#### Built-in Modes
- **🎤 Normal Mode**: Standard transcription for general use
- **📧 Email Mode**: Formats transcription as professional emails

#### Custom Modes
Create unlimited custom modes for specific use cases:
- **Meeting Notes**: Structured note-taking format
- **Code Comments**: Format for code documentation  
- **Creative Writing**: Optimized for storytelling
- **Technical Documentation**: Structured technical writing

### Mode Switching
- **Quick Switch**: Press `Alt+Shift+M` (or your custom hotkey) to cycle through modes
- **Visual Feedback**: A beautiful overlay shows which mode you've switched to
- **Tray Menu**: Right-click the tray icon to see the current mode

### Hotkey Configuration
Customize both hotkeys in Settings:
- **Recording Hotkey**: Default `Alt+Space`
- **Mode Switch Hotkey**: Default `Alt+Shift+M`

## ⚙️ Settings Reference

### General Tab
- **API Key**: Your Google Gemini API key
- **AI Model**: Choose from available Gemini models
- **Audio Quality**: Standard (16kHz) or High (44.1kHz)
- **Overlay Position**: Center, Top, or Bottom
- **Auto-Paste**: Automatically paste transcribed text
- **Notifications**: Show system notifications
- **Auto-Start**: Launch with Windows
- **Minimize to Tray**: Hide to system tray when closed

### Modes Tab
- **Built-in Modes**: Edit prompts for Normal and Email modes
- **Custom Modes**: Create, edit, and delete custom transcription modes
- **Mode Management**: Activate different modes and manage your collection

### Hotkeys Tab
- **Recording Hotkey**: Set your preferred recording shortcut
- **Mode Switch Hotkey**: Set your preferred mode switching shortcut
- **Real-time Capture**: Press keys to set new hotkey combinations

### Advanced Tab
- **Current Mode**: Quick mode selection dropdown
- **Privacy Information**: Understanding how your data is handled
- **Troubleshooting**: Reset settings and get help

## 🎨 Creating Custom Modes

Custom modes allow you to tailor AI transcription for specific use cases:

### Example: Meeting Notes Mode
```
Name: Meeting Notes
Icon: 📝
Prompt: Transcribe this audio as structured meeting notes. Format with bullet points, action items, and key decisions. Focus on clear, professional language suitable for sharing with team members.
```

### Example: Code Documentation Mode  
```
Name: Code Comments
Icon: 💻  
Prompt: Transcribe this audio as clear, concise code comments and documentation. Focus on explaining functionality, parameters, and return values in a technical but accessible way.
```

### Prompt Tips
- Be specific about formatting requirements
- Include context about the intended audience
- Specify tone and style preferences
- Mention any special formatting needs

## 🔧 Troubleshooting

### Common Issues

#### API Key Problems
- **Invalid Key**: Ensure you copied the complete API key from Google AI Studio
- **Quota Exceeded**: Check your API usage limits in Google AI Studio
- **Network Issues**: Verify internet connection and firewall settings

#### Recording Issues
- **No Audio Detected**: Check microphone permissions and default audio device
- **Poor Quality**: Try increasing audio quality in settings
- **SoX Errors**: Audio processing requires the bundled SoX executable

#### Hotkey Conflicts
- **Keys Not Working**: Check for conflicts with other applications
- **Change Hotkeys**: Use the Settings panel to set alternative key combinations

### Getting Help
1. Check the [Issues page](https://github.com/yourusername/geminiwhisper/issues) for known problems
2. Reset settings using the "Reset All Settings" button in Advanced tab
3. Restart the application and try again
4. Create a new issue with detailed error information

## 🔒 Privacy & Security

### Data Handling
- **API Key**: Stored securely on your device using encryption
- **Audio Files**: Temporarily stored locally, deleted after transcription
- **No Cloud Storage**: Audio never stored in the cloud except during transcription
- **No Telemetry**: No usage data collected or transmitted

### Google Gemini API
- Audio is sent to Google's Gemini API for transcription only
- Refer to [Google's Privacy Policy](https://policies.google.com/privacy) for their data handling
- Consider using this tool in compliance with your organization's policies

## 🛠️ Development

### Tech Stack
- **Electron**: Cross-platform desktop application framework
- **Node.js**: Runtime environment
- **SoX**: Audio processing and normalization
- **Google Gemini API**: AI-powered transcription

### Project Structure
```
geminiwhisper/
├── main.js              # Main Electron process
├── preload.js           # Secure IPC bridge
├── dist/                # Built UI files
│   ├── settings.html    # Settings interface
│   ├── settings.js      # Settings functionality
│   ├── overlay.html     # Recording overlay
│   ├── overlay.js       # Overlay interactions
│   ├── mode-overlay.html # Mode switch display
│   └── mode-overlay.js  # Mode switch logic
├── bin/sox/             # Audio processing tools
└── src/                 # Source modules (legacy)
```

### Building
```bash
# Development
npm run dev

# Build for Windows
npm run dist

# Clean build
rm -rf dist/ release/
npm run dist
```

### Contributing
1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit with clear messages: `git commit -m "Add feature description"`
5. Push and create a Pull Request

## 📝 Changelog

### Version 2.0.0 (Latest)
- ✨ **New**: Custom transcription modes with unlimited possibilities
- ✨ **New**: Modern, animated recording overlay with status indicators
- ✨ **New**: Beautiful settings interface with tabbed navigation
- ✨ **New**: Mode switching with visual feedback overlay
- ✨ **New**: Customizable hotkeys for recording and mode switching
- ✨ **New**: Auto-startup with Windows option
- ✨ **New**: Enhanced audio quality options
- ✨ **New**: Flexible overlay positioning
- 🎨 **Improved**: Complete UI redesign with modern aesthetics
- 🎨 **Improved**: Better error handling and user feedback
- 🎨 **Improved**: Dark mode support throughout the application
- 🔧 **Enhanced**: More robust audio processing
- 🔧 **Enhanced**: Better API key validation and testing
- 📚 **Added**: Comprehensive documentation and help system

### Version 1.0.0
- Basic voice transcription functionality
- Simple overlay interface
- Google Gemini API integration
- Auto-paste feature

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Google Gemini API](https://ai.google.dev/) for powerful AI transcription
- [Electron](https://electronjs.org/) for cross-platform desktop framework
- [SoX](http://sox.sourceforge.net/) for audio processing capabilities
- [Auto-Launch](https://github.com/Teamwork/node-auto-launch) for startup integration

## 🔗 Links

- [Download Latest Release](https://github.com/yourusername/geminiwhisper/releases)
- [Report Issues](https://github.com/yourusername/geminiwhisper/issues)
- [Feature Requests](https://github.com/yourusername/geminiwhisper/discussions)
- [Google AI Studio](https://aistudio.google.com/)

---

**Made with ❤️ for productivity enthusiasts and voice-to-text power users**
