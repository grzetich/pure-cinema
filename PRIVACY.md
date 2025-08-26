# Privacy Policy - Pure Cinema

## Data Collection Statement

**Pure Cinema collects ZERO data from users. We do not track, store, or transmit any user information.**

## What We Do

✅ **Local Recording Only**: All terminal recordings are stored locally on your machine  
✅ **No Network Requests**: Extension operates entirely offline with no external connections  
✅ **User-Controlled Storage**: You choose where recordings are saved via file dialogs  
✅ **Open Source**: All code is publicly available for inspection  

## What We DON'T Do

❌ **No Keystroke Logging**: We don't monitor or record your keystrokes  
❌ **No Data Transmission**: No data leaves your machine  
❌ **No Analytics**: No usage tracking or telemetry  
❌ **No Cloud Storage**: All data stays on your local filesystem  
❌ **No Background Monitoring**: Only records when you explicitly start recording  

## Technical Implementation

### Recording Process
1. **Explicit Start**: Recording only begins when you manually trigger "Start Recording"
2. **Visual Indicators**: Clear status bar indication when recording is active
3. **User Control**: You control start, stop, and save locations
4. **Local Files**: Recordings saved as `.pcr` files on your local filesystem

### Data Storage
- **Format**: JSON text files (.pcr extension)
- **Location**: Your chosen directory via save dialog
- **Content**: Only terminal output you explicitly choose to record
- **Access**: Only accessible to you and applications you authorize

### Code Transparency
- **Open Source**: Full source code available for security audit
- **No Obfuscation**: All code is readable TypeScript/JavaScript
- **VS Code Standards**: Follows Microsoft's extension security guidelines

## Your Rights

- **Full Control**: Delete recordings anytime by deleting .pcr files
- **No Persistence**: Uninstalling removes all extension code
- **Audit Capability**: Review all source code for security verification
- **Selective Recording**: Choose exactly what and when to record

## Security Measures

1. **No Network Permissions**: Extension manifest requests no network access
2. **Minimal Permissions**: Only requests terminal access when recording
3. **Local Processing**: All operations performed locally
4. **No Third-Party Services**: Zero external dependencies for data handling

## Compliance

This extension is designed to comply with:
- GDPR (General Data Protection Regulation)
- CCPA (California Consumer Privacy Act)
- Enterprise security policies
- Local data residency requirements

## Questions?

Review our source code at: [Repository URL]  
Report security concerns via: [GitHub Issues]

**Last Updated**: August 11, 2025