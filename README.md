# Pure Cinema 🎬

**Record terminal sessions directly in VS Code - completely private and local**

Pure Cinema brings asciinema-style terminal recording directly into Visual Studio Code. Perfect for creating demos, documentation, and sharing terminal workflows. **100% private** - no data ever leaves your machine.

## Features

- **🎬 Record terminal sessions** from within VS Code
- **💾 Compact file format** (.pcr) for efficient storage
- **📋 Text copyability** - viewers can copy text from recordings
- **✂️ Edit recordings** - trim timeline and adjust dimensions
- **🚀 Export & Share** - web-compatible formats with social sharing
- **🌐 Cross-platform compatibility** - works on all VS Code supported platforms
- **🔒 100% Private** - all data stays on your local machine
- **🚫 No network requests** - works completely offline
- **✅ Open source** - full code transparency

## Usage

### Recording a Terminal Session

1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run **"Pure Cinema: Start Recording"**
3. A new terminal will open - perform your actions
4. Run **"Pure Cinema: Stop Recording"** when finished
5. Choose where to save your recording (.pcr file)

![Recording Demo](https://raw.githubusercontent.com/grzetich/pure-cinema/main/docs/demo-recording.gif)

### Playing a Recording

1. Use the command palette (Ctrl+Shift+P / Cmd+Shift+P)
2. Run "Pure Cinema: Play Recording"
3. Select a .pcr file to play
4. Use the player controls to play, pause, or seek through the recording
5. Click "Copy All" to copy the entire terminal output

### Editing a Recording

1. Use the command palette (Ctrl+Shift+P / Cmd+Shift+P)
2. Run "Pure Cinema: Edit Recording"
3. Select a .pcr file to edit
4. Adjust dimensions (width/height in characters)
5. Trim timeline (set start/end points in seconds)
6. Preview changes or save directly

### Exporting & Sharing

1. Use the command palette (Ctrl+Shift+P / Cmd+Shift+P)
2. Run "Pure Cinema: Export & Share Recording"
3. Select a .pcr file to export
4. Choose format (HTML, JSON, GIF*, MP4*)
5. Configure theme and playback options
6. Export file or use quick-share buttons for social platforms

*GIF and MP4 export coming soon

## Commands

- `pure-cinema.startRecording` - Start recording the active terminal
- `pure-cinema.stopRecording` - Stop the current recording
- `pure-cinema.playRecording` - Play a saved recording
- `pure-cinema.editRecording` - Edit an existing recording
- `pure-cinema.exportRecording` - Export & share recordings in web formats

## File Format

Pure Cinema recordings are saved as JSON files with the `.pcr` extension containing:
- Recording metadata (start/end time, terminal info)
- Frame-by-frame terminal output with timestamps
- Input/output differentiation

## Development

To run the extension in development mode:

1. Install dependencies: `npm install`
2. Compile TypeScript: `npm run compile`
3. Press F5 to launch a new VS Code window with the extension loaded

## Privacy & Security

Pure Cinema is designed with privacy as the top priority:

- **Local only**: All recordings stored on your machine
- **No data collection**: We don't track or collect any user data
- **No network access**: Extension operates entirely offline
- **Open source**: Full code available for security audit
- **User control**: You choose when to record and where to save files

See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md) for detailed information.

## Requirements

- Visual Studio Code 1.74.0 or higher

## Contributing

This is an open source project. Contributions are welcome via GitHub pull requests.

## License

MIT - See [LICENSE](LICENSE) file for details