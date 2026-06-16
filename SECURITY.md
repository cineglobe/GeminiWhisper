# Security Policy

GeminiWhisper is designed to be a very secure, local-first Windows dictation app. The project aims to keep user secrets and recordings under the user's control while avoiding unnecessary data collection.

## Security model

- **Local API key storage:** Gemini API keys are stored locally using `electron-store` encryption.
- **No telemetry:** GeminiWhisper does not include analytics, tracking, or telemetry.
- **Minimal network access:** Audio is sent only to the configured Google Gemini API endpoint for transcription.
- **Local recording control:** Recordings and transcripts are saved locally on the user's machine, and temporary processing files are cleaned up after transcription.
- **Least-privilege desktop behavior:** The Windows installer requests normal user privileges (`asInvoker`) rather than administrator elevation.
- **Secure renderer bridge:** Settings and renderer UI communicate through the Electron preload bridge instead of exposing Node.js directly to the page.

## Supported versions

Security fixes are applied to the latest public release and the `main` branch.

| Version | Supported |
| --- | --- |
| 2.1.x | Yes |
| 2.0.x | Best effort |
| 1.0.x | No |

## Reporting a vulnerability

Please report suspected vulnerabilities privately to the maintainer before opening a public issue.

Include:

- A short summary of the issue
- Steps to reproduce
- Affected version or commit
- Impact and any known workaround

If the issue is valid, the maintainer will coordinate a fix and release notes before public disclosure.

## Scope

In scope:

- Secret/API key handling
- Electron preload/renderer boundaries
- Unexpected file writes or persistence
- Unsafe auto-paste behavior
- Installer or update packaging concerns

Out of scope:

- Vulnerabilities in Google Gemini or Google AI Studio
- Local malware or compromised Windows user accounts
- Issues caused by modified/unofficial builds
