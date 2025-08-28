# Product Overview:
## Project Title/Code: pure-cinema 
## Responsible Manager(s): Claude and I
## Date of Creation/Version: 10 August 2025 
## Overview/Purpose: Prove a terminal recording experience similar to asciinema but as a Visual Studio Code plugin. 
## Target Market/Audience: Software developers and vibe coders, especially those without deep technical experience that may have trouble setting up WSL and running asciicenema in it. 
## Features and Functionality:
Features: Core functionalities and capabilities of the product:
* **Real Shell Recording**: Record actual terminal sessions with real command execution (npm, git, etc.)
* **Cross-Platform Support**: Works with cmd.exe on Windows, bash/zsh on macOS/Linux
* **Workspace Trust Integration**: Requires trusted workspace for security compliance
* **Transparent Security**: All commands visible to users with explicit consent
* Save in a compact file format with rich terminal data (colors, formatting, timing)
* Allow viewers to copy text out of recordings (real command output and errors)
* Allow users to make minor edits to recordings:
    * Change dimensions of recording
    * Change start and end points of recording and trim
    * Edit out sensitive information from real command sessions
* Allow users to export recordings in a format compatible with sharing on the Web and to socials:
    * Interactive HTML with real terminal colors and formatting
    * Include share to socials buttons
    * Generate documentation from real development workflows
* Allow users to open and watch saved .pcr files with authentic playback
## User Stories/Use Cases 
 Software developers and vibe coders, especially those without deep technical experience that may have trouble setting up WSL and running asciicenema in it. 
## Design
TBD. Includes wireframes, mockups, and design specifications to guide the visual and interactive aspects of the product. 
## Technical Specifications
1. Compatible with all operating systems supported by Visual Studio Code.
2. Produce compact files of recordings.
3. **Real Shell Integration**: Use external process approach with native terminal emulation for authentic recording capability.
4. **Security & Trust Model**: Implement VS Code Workspace Trust compliance and transparent command execution.
5. **Platform-Specific Deployment**: Support native binaries across Windows, macOS, and Linux platforms.
## Constraints/Dependencies

### VS Code Marketplace Security Requirements
- **No Manual Review Process**: Extensions are published through automated scanning only
- **Security Scanning**: All extensions undergo malware scanning and dynamic behavior analysis
- **Community Trust**: Building publisher reputation is critical for user adoption
- **Workspace Trust Integration**: Must respect VS Code's security model for untrusted workspaces

### Technical Dependencies
- **node-pty**: Native terminal emulation library requiring platform-specific compilation
- **Platform-Specific Builds**: Separate extension packages for Windows, macOS, and Linux
- **Native Binary Distribution**: Requires shipping compiled binaries for each supported platform

### User Security & Privacy
- **Transparent Command Execution**: All shell commands must be visible to users with consent dialogs
- **Local Processing Only**: All recording and processing happens on user's machine
- **No Data Transmission**: Maintain privacy-first approach with no external data collection 
## Environmental/Safety Requirements:
TBD. Specifies any environmental conditions or safety standards the product needs to meet. 
## Success and Release Criteria:
TBD. Need to determine how to gauge customer sentiment for VSCode plugins.
## Release Criteria: 
1. MVP: Basic functionality.
2. Compact files.
3. Viewers can copy from recordings. 
## Timeline/Release Planning: 
MVP ASAP. Compact files and copying from recordings +2 months. 
## Stakeholders and Communication:
Claude and I
## Open Questions/Future Work:

### Enhanced Playback Options:
* Standalone web player - drag & drop .pcr files onto web page, no VS Code required
* CLI playback tool - terminal-based player with cross-platform binary support
* Browser extension - Chrome/Firefox extension for direct .pcr file viewing
* Desktop application - Electron-based standalone player with file associations
* Embedded players - GitHub Pages integration and Markdown embedding support
* Mobile playback - responsive web players for mobile devices

### Export Format Enhancements:
* GIF animation export - implement frame capture and GIF generation
* MP4 video export - add video encoding capabilities for social media
* SVG export - vector-based format for documentation
* Animated terminal sessions in presentations (PowerPoint, Google Slides)

### Recording Features:
* Multi-terminal recording - record multiple terminal sessions simultaneously
* Recording templates - predefined settings for common use cases
* Keyboard shortcuts - quick recording start/stop hotkeys
* Auto-recording triggers - record based on commands or events
* Screen recording integration - capture both terminal and VS Code interface

### Sharing & Collaboration:
* Cloud hosting integration - one-click upload to GitHub Pages, Netlify, etc.
* Collaborative viewing - shared sessions with comments and annotations
* Recording galleries - curated collections of terminal recordings
* Integration with documentation platforms (GitBook, Notion, Confluence)

### Analytics & Insights:
* Recording performance metrics - file size optimization suggestions
* Playback analytics - view counts and engagement metrics (privacy-preserving)
* Popular command tracking - identify commonly recorded operations

### Developer Experience:
* API for programmatic recording control
* Plugin architecture for custom exporters
* Integration with VS Code tasks and scripts
* Batch processing tools for multiple recordings
* Recording compression and optimization tools

### Accessibility & Internationalization:
* Screen reader compatibility for recordings
* Keyboard navigation for playback controls
* Multi-language support for interface
* High contrast and accessibility themes
* Subtitle/caption support for recorded sessions

### Enterprise Features:
* Recording encryption for sensitive content
* Team sharing with access controls
* Integration with corporate identity providers
* Audit logs for recording creation and sharing
* Policy controls for recording duration and retention
## Glossary/Explanation of Terms:
TBD. 