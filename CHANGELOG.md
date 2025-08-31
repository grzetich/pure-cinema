# Change Log

All notable changes to the "Pure Cinema" extension will be documented in this file.

## [1.0.0] - 2025-08-31

### Added
- 🎬 Terminal recording functionality directly in VS Code
- 🎮 Recording playback with interactive controls
- ✂️ Recording editor with timeline trimming and dimension adjustment
- 🌐 Export capabilities to HTML and JSON formats
- 📋 Text copying from recordings
- 🔒 100% private and local operation - no network requests
- 🌐 Cross-platform compatibility (Windows, macOS, Linux)
- 💾 Compact .pcr file format for efficient storage

### Features
- **Recording**: Record terminal sessions with input/output capture
- **Playback**: Play recordings with seek controls and text selection
- **Editing**: Trim recordings and adjust terminal dimensions
- **Export**: Share recordings as web-compatible HTML files
- **Privacy**: All data remains on your local machine

### Commands
- `Pure Cinema: Start Recording` - Begin recording terminal session
- `Pure Cinema: Stop Recording` - End current recording
- `Pure Cinema: Play Recording` - Playback saved recordings
- `Pure Cinema: Edit Recording` - Edit existing recordings
- `Pure Cinema: Export & Share Recording` - Export to various formats

### Technical
- Built with TypeScript for VS Code
- Uses pseudoterminal for accurate recording
- Cross-platform shell support (cmd.exe, bash, zsh)
- Frame-based recording format with timestamps
- Real-time input/output differentiation

### Security & Privacy
- No data collection or telemetry
- No network requests or external dependencies
- All processing happens locally
- Open source codebase for transparency
- User controls all data and file locations