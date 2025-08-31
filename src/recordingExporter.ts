import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { Recording, RecordingFrame } from './terminalRecorder';

export type ExportFormat = 'html' | 'gif' | 'mp4' | 'json';

export interface ExportOptions {
    format: ExportFormat;
    includeControls: boolean;
    theme: 'dark' | 'light' | 'auto';
    socialPlatform?: 'twitter' | 'linkedin' | 'github' | 'dev.to';
}

export class RecordingExporter implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];

    constructor() {}

    public async exportRecording(uri: vscode.Uri): Promise<void> {
        try {
            const content = await fs.promises.readFile(uri.fsPath, 'utf8');
            const recording: Recording = JSON.parse(content);
            
            await this.showExportOptions(recording, uri);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load recording for export: ${error}`);
        }
    }

    public async shareRecordingToGist(uri: vscode.Uri): Promise<void> {
        try {
            const content = await fs.promises.readFile(uri.fsPath, 'utf8');
            const recording: Recording = JSON.parse(content);
            
            await this.shareToGitHubGist(recording, 'github', uri);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load recording for GitHub Gist sharing: ${error}`);
        }
    }

    private async showExportOptions(recording: Recording, originalUri: vscode.Uri): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'pure-cinema-exporter',
            'Export Recording - Pure Cinema',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: []
            }
        );

        panel.webview.html = this.getExportWebviewContent(recording);

        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'export':
                        await this.performExport(recording, message.options, originalUri);
                        break;
                    case 'preview':
                        await this.previewExport(recording, message.options);
                        break;
                    case 'shareToSocial':
                        await this.shareToSocial(recording, message.platform, originalUri);
                        break;
                }
            },
            undefined,
            this.disposables
        );

        this.disposables.push(panel);
    }

    private async performExport(recording: Recording, options: ExportOptions, originalUri: vscode.Uri): Promise<void> {
        const baseName = path.basename(originalUri.fsPath, '.pcr');
        let defaultFileName = '';
        let filters: { [key: string]: string[] } = {};

        switch (options.format) {
            case 'html':
                defaultFileName = `${baseName}-export.html`;
                filters = { 'HTML Files': ['html'] };
                break;
            case 'gif':
                defaultFileName = `${baseName}-export.gif`;
                filters = { 'GIF Files': ['gif'] };
                break;
            case 'mp4':
                defaultFileName = `${baseName}-export.mp4`;
                filters = { 'MP4 Files': ['mp4'] };
                break;
            case 'json':
                defaultFileName = `${baseName}-export.json`;
                filters = { 'JSON Files': ['json'] };
                break;
        }

        const saveUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.joinPath(vscode.Uri.file(path.dirname(originalUri.fsPath)), defaultFileName),
            filters
        });

        if (!saveUri) {return;}

        try {
            let exportContent = '';

            switch (options.format) {
                case 'html':
                    exportContent = this.generateHtmlExport(recording, options);
                    break;
                case 'json':
                    exportContent = this.generateJsonExport(recording);
                    break;
                case 'gif':
                    await this.generateGifExport(recording, saveUri.fsPath, options);
                    return;
                case 'mp4':
                    await this.generateMp4Export(recording, saveUri.fsPath, options);
                    return;
            }

            await fs.promises.writeFile(saveUri.fsPath, exportContent, 'utf8');
            
            const openChoice = await vscode.window.showInformationMessage(
                `Recording exported successfully to ${path.basename(saveUri.fsPath)}`,
                'Open File'
            );

            if (openChoice === 'Open File') {
                vscode.env.openExternal(saveUri);
            }

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to export recording: ${error}`);
        }
    }

    private generateHtmlExport(recording: Recording, options: ExportOptions): string {
        const duration = recording.endTime ? recording.endTime - recording.startTime : 0;
        const durationSeconds = (duration / 1000).toFixed(1);
        const dimensions = recording.dimensions || { width: 80, height: 24 };

        const theme = options.theme === 'light' ? 'light' : 'dark';
        const backgroundColor = theme === 'light' ? '#ffffff' : '#1e1e1e';
        const textColor = theme === 'light' ? '#000000' : '#d4d4d4';
        const borderColor = theme === 'light' ? '#cccccc' : '#333333';

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pure Cinema Recording</title>
    <meta name="description" content="Terminal recording created with Pure Cinema VS Code extension">
    <meta property="og:title" content="Terminal Recording - Pure Cinema">
    <meta property="og:description" content="Interactive terminal session recording">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Terminal Recording - Pure Cinema">
    <meta name="twitter:description" content="Interactive terminal session recording">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: ${backgroundColor};
            color: ${textColor};
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            border-bottom: 1px solid ${borderColor};
        }
        
        .header h1 {
            margin: 0 0 10px 0;
            font-size: 28px;
        }
        
        .header p {
            margin: 0;
            color: #666;
            font-size: 16px;
        }
        
        .recording-info {
            background-color: ${theme === 'light' ? '#f8f9fa' : '#2d2d2d'};
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            border: 1px solid ${borderColor};
            display: flex;
            justify-content: space-around;
            text-align: center;
        }
        
        .info-item {
            flex: 1;
        }
        
        .info-label {
            font-weight: bold;
            display: block;
            margin-bottom: 5px;
        }
        
        ${options.includeControls ? `
        .controls {
            margin-bottom: 20px;
            display: flex;
            gap: 10px;
            align-items: center;
            justify-content: center;
            padding: 15px;
            background-color: ${theme === 'light' ? '#f8f9fa' : '#2d2d2d'};
            border-radius: 8px;
            border: 1px solid ${borderColor};
        }
        
        button {
            background-color: #007acc;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.2s;
        }
        
        button:hover {
            background-color: #005a9e;
        }
        
        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        
        .progress-container {
            flex: 1;
            margin: 0 15px;
        }
        
        .progress-bar {
            width: 100%;
            height: 6px;
            background-color: ${borderColor};
            border-radius: 3px;
            cursor: pointer;
        }
        
        .progress-fill {
            height: 100%;
            background-color: #007acc;
            border-radius: 3px;
            transition: width 0.1s ease;
        }
        ` : ''}
        
        .terminal-container {
            max-width: 100%;
            margin: 0 auto;
            position: relative;
        }
        
        .terminal-output {
            background-color: #1e1e1e;
            color: #d4d4d4;
            padding: 20px;
            border-radius: 8px;
            font-family: 'Courier New', Consolas, 'Liberation Mono', monospace;
            font-size: 14px;
            line-height: 1.4;
            white-space: pre-wrap;
            overflow: auto;
            border: 1px solid ${borderColor};
            min-height: 400px;
            user-select: text;
        }
        
        .copy-button {
            position: absolute;
            top: 10px;
            right: 10px;
            background-color: rgba(255, 255, 255, 0.1);
            color: #d4d4d4;
            border: 1px solid rgba(255, 255, 255, 0.2);
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.2s;
        }
        
        .copy-button:hover {
            background-color: rgba(255, 255, 255, 0.2);
        }
        
        .share-buttons {
            margin-top: 20px;
            text-align: center;
            padding: 20px;
            border-top: 1px solid ${borderColor};
        }
        
        .share-button {
            display: inline-block;
            margin: 0 10px;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            transition: transform 0.2s;
        }
        
        .share-button:hover {
            transform: translateY(-2px);
        }
        
        .share-twitter {
            background-color: #1da1f2;
            color: white;
        }
        
        .share-linkedin {
            background-color: #0077b5;
            color: white;
        }
        
        .share-github {
            background-color: #333;
            color: white;
        }
        
        .share-dev {
            background-color: #0a0a0a;
            color: white;
        }
        
        .footer {
            margin-top: 40px;
            text-align: center;
            color: #666;
            font-size: 14px;
            border-top: 1px solid ${borderColor};
            padding-top: 20px;
        }
        
        .footer a {
            color: #007acc;
            text-decoration: none;
        }
        
        @media (max-width: 768px) {
            body {
                padding: 10px;
            }
            
            .recording-info {
                flex-direction: column;
                text-align: left;
            }
            
            .info-item {
                margin-bottom: 10px;
            }
            
            .controls {
                flex-wrap: wrap;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎬 Terminal Recording</h1>
        <p>Created with Pure Cinema for VS Code</p>
    </div>
    
    <div class="recording-info">
        <div class="info-item">
            <span class="info-label">Duration</span>
            <span>${durationSeconds}s</span>
        </div>
        <div class="info-item">
            <span class="info-label">Dimensions</span>
            <span>${dimensions.width} × ${dimensions.height}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Terminal</span>
            <span>${recording.terminalInfo.name || 'Unknown'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Frames</span>
            <span>${recording.frames.length}</span>
        </div>
    </div>
    
    ${options.includeControls ? `
    <div class="controls">
        <button id="playBtn">▶ Play</button>
        <button id="pauseBtn" disabled>⏸ Pause</button>
        <button id="resetBtn">⏮ Reset</button>
        <div class="progress-container">
            <div class="progress-bar" id="progressBar">
                <div class="progress-fill" id="progressFill"></div>
            </div>
        </div>
        <span id="timeDisplay">0.0s / ${durationSeconds}s</span>
    </div>
    ` : ''}
    
    <div class="terminal-container">
        <div class="terminal-output" id="terminalOutput"></div>
        <button class="copy-button" onclick="copyToClipboard()">📋 Copy</button>
    </div>
    
    <div class="share-buttons">
        <h3>Share This Recording</h3>
        <a href="#" class="share-button share-twitter" onclick="shareToTwitter()">📱 Twitter</a>
        <a href="#" class="share-button share-linkedin" onclick="shareToLinkedIn()">💼 LinkedIn</a>
        <a href="#" class="share-button share-github" onclick="shareToGitHub()">🐙 GitHub</a>
        <a href="#" class="share-button share-dev" onclick="shareToDevTo()">👩‍💻 DEV</a>
    </div>
    
    <div class="footer">
        <p>Recording created with <a href="https://github.com/pure-cinema/pure-cinema" target="_blank">Pure Cinema</a> • 
           <a href="https://marketplace.visualstudio.com/items?itemName=pure-cinema" target="_blank">Get the VS Code Extension</a></p>
    </div>

    <script>
        const recording = ${JSON.stringify(recording)};
        
        let isPlaying = false;
        let currentFrame = 0;
        let outputContent = '';
        
        ${options.includeControls ? this.getPlayerJavaScript() : ''}
        
        function copyToClipboard() {
            const content = document.getElementById('terminalOutput').textContent;
            navigator.clipboard.writeText(content).then(() => {
                const btn = document.querySelector('.copy-button');
                const original = btn.textContent;
                btn.textContent = '✅ Copied!';
                setTimeout(() => {
                    btn.textContent = original;
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy:', err);
            });
        }
        
        function shareToTwitter() {
            const text = "Check out this terminal recording created with Pure Cinema! 🎬";
            const url = window.location.href;
            window.open(\`https://twitter.com/intent/tweet?text=\${encodeURIComponent(text)}&url=\${encodeURIComponent(url)}\`, '_blank');
        }
        
        function shareToLinkedIn() {
            const url = window.location.href;
            window.open(\`https://www.linkedin.com/sharing/share-offsite/?url=\${encodeURIComponent(url)}\`, '_blank');
        }
        
        function shareToGitHub() {
            // For GitHub, we'll copy the URL to clipboard and show instructions
            navigator.clipboard.writeText(window.location.href).then(() => {
                alert('URL copied to clipboard! You can now paste it in your GitHub issue, PR, or README.');
            });
        }
        
        function shareToDevTo() {
            const title = "Terminal Recording - Pure Cinema";
            const url = window.location.href;
            window.open(\`https://dev.to/new?prefill=---%0Atitle: \${encodeURIComponent(title)}%0Apublished: false%0A---%0A%0ACheck out this terminal recording: \${encodeURIComponent(url)}\`, '_blank');
        }
        
        // Initialize display
        ${options.includeControls ? 'updateDisplay();' : 'showStaticContent();'}
        
        function showStaticContent() {
            const output = recording.frames
                .filter(frame => frame.type === 'output')
                .map(frame => frame.content)
                .join('');
            document.getElementById('terminalOutput').textContent = output;
        }
    </script>
</body>
</html>`;
    }

    private getPlayerJavaScript(): string {
        return `
        const playBtn = document.getElementById('playBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const resetBtn = document.getElementById('resetBtn');
        const progressBar = document.getElementById('progressBar');
        const progressFill = document.getElementById('progressFill');
        const timeDisplay = document.getElementById('timeDisplay');
        const terminalOutput = document.getElementById('terminalOutput');
        
        function updateDisplay() {
            terminalOutput.textContent = outputContent;
            
            if (recording.frames.length > 0) {
                const progress = (currentFrame / recording.frames.length) * 100;
                progressFill.style.width = progress + '%';
                
                const currentTime = currentFrame > 0 ? (recording.frames[currentFrame - 1].timestamp / 1000).toFixed(1) : '0.0';
                const totalTime = ((recording.endTime - recording.startTime) / 1000).toFixed(1);
                timeDisplay.textContent = currentTime + 's / ' + totalTime + 's';
            }
        }
        
        function playRecording() {
            if (currentFrame >= recording.frames.length) {
                isPlaying = false;
                playBtn.disabled = false;
                pauseBtn.disabled = true;
                return;
            }
            
            const frame = recording.frames[currentFrame];
            if (frame.type === 'output' || frame.type === 'input') {
                outputContent += frame.content;
            }
            
            currentFrame++;
            updateDisplay();
            
            if (isPlaying && currentFrame < recording.frames.length) {
                const nextFrame = recording.frames[currentFrame];
                const delay = Math.max(1, nextFrame.timestamp - frame.timestamp);
                
                setTimeout(() => {
                    if (isPlaying) {
                        playRecording();
                    }
                }, delay);
            } else if (currentFrame >= recording.frames.length) {
                isPlaying = false;
                playBtn.disabled = false;
                pauseBtn.disabled = true;
            }
        }
        
        playBtn.addEventListener('click', () => {
            isPlaying = true;
            playBtn.disabled = true;
            pauseBtn.disabled = false;
            playRecording();
        });
        
        pauseBtn.addEventListener('click', () => {
            isPlaying = false;
            playBtn.disabled = false;
            pauseBtn.disabled = true;
        });
        
        resetBtn.addEventListener('click', () => {
            isPlaying = false;
            currentFrame = 0;
            outputContent = '';
            playBtn.disabled = false;
            pauseBtn.disabled = true;
            updateDisplay();
        });
        
        progressBar.addEventListener('click', (e) => {
            const rect = progressBar.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const progress = clickX / rect.width;
            
            currentFrame = Math.floor(progress * recording.frames.length);
            
            outputContent = '';
            for (let i = 0; i < currentFrame; i++) {
                const frame = recording.frames[i];
                if (frame.type === 'output' || frame.type === 'input') {
                    outputContent += frame.content;
                }
            }
            
            updateDisplay();
        });
        `;
    }

    private generateJsonExport(recording: Recording): string {
        // Enhanced JSON export with metadata
        const exportData = {
            ...recording,
            exportInfo: {
                exportedAt: new Date().toISOString(),
                exportedBy: 'Pure Cinema VS Code Extension',
                version: recording.version
            }
        };
        
        return JSON.stringify(exportData, null, 2);
    }

    private async generateGifExport(recording: Recording, outputPath: string, options: ExportOptions): Promise<void> {
        // For now, show a message that GIF export requires additional dependencies
        // In a full implementation, you'd use libraries like puppeteer + gif encoder
        vscode.window.showWarningMessage(
            'GIF export is not yet implemented. This would require additional dependencies for frame capture and GIF generation. Consider exporting as HTML for now.',
            'Export as HTML Instead'
        ).then(choice => {
            if (choice === 'Export as HTML Instead') {
                const htmlOptions = { ...options, format: 'html' as ExportFormat };
                const htmlPath = outputPath.replace('.gif', '.html');
                const htmlContent = this.generateHtmlExport(recording, htmlOptions);
                fs.promises.writeFile(htmlPath, htmlContent, 'utf8');
            }
        });
    }

    private async generateMp4Export(recording: Recording, outputPath: string, options: ExportOptions): Promise<void> {
        // Similar to GIF - would need video encoding libraries
        vscode.window.showWarningMessage(
            'MP4 export is not yet implemented. This would require video encoding libraries. Consider exporting as HTML for now.',
            'Export as HTML Instead'
        ).then(choice => {
            if (choice === 'Export as HTML Instead') {
                const htmlOptions = { ...options, format: 'html' as ExportFormat };
                const htmlPath = outputPath.replace('.mp4', '.html');
                const htmlContent = this.generateHtmlExport(recording, htmlOptions);
                fs.promises.writeFile(htmlPath, htmlContent, 'utf8');
            }
        });
    }

    private async previewExport(recording: Recording, options: ExportOptions): Promise<void> {
        const previewPanel = vscode.window.createWebviewPanel(
            'pure-cinema-export-preview',
            'Export Preview - Pure Cinema',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                localResourceRoots: []
            }
        );

        // Generate preview based on format
        let previewContent = '';
        switch (options.format) {
            case 'html':
                previewContent = this.generateHtmlExport(recording, options);
                break;
            default:
                previewContent = `<h2>Preview for ${options.format.toUpperCase()}</h2><p>Preview not available for this format.</p>`;
        }

        previewPanel.webview.html = previewContent;
        this.disposables.push(previewPanel);
    }

    private async shareToSocial(recording: Recording, platform: string, originalUri: vscode.Uri): Promise<void> {
        const choice = await vscode.window.showQuickPick([
            {
                label: '🎬 Create Interactive Gist',
                description: 'Upload interactive playback to GitHub Gist',
                detail: 'Shareable URL with step-by-step terminal playback'
            },
            {
                label: '🌐 Export Interactive HTML',
                description: 'Generate HTML file for web hosting',
                detail: 'Full-featured player for GitHub Pages, Netlify, etc.'
            },
            {
                label: '📋 Copy Share Text',
                description: 'Copy formatted text about this recording',
                detail: 'Quick post with recording stats and extension link'
            }
        ], {
            placeHolder: `Share your terminal recording to ${platform}`
        });

        if (!choice) {return;}

        switch (choice.label) {
            case '🎬 Create Interactive Gist':
                await this.shareToGitHubGist(recording, platform, originalUri);
                break;
            case '🌐 Export Interactive HTML':
                await this.exportHtmlForManualSharing(recording, platform, originalUri);
                break;
            case '📋 Copy Share Text':
                await this.copyShareText(recording, platform);
                break;
        }
    }

    private async copyShareText(recording: Recording, platform: string): Promise<void> {
        const duration = recording.endTime ? ((recording.endTime - recording.startTime) / 1000).toFixed(1) : '0.0';
        const commandCount = recording.frames.filter(frame => frame.type === 'input').length;
        
        const shareText = `🎬 Just recorded a ${duration}s terminal session with ${commandCount} commands using Pure Cinema!

✨ Interactive terminal recordings right in VS Code
🔗 Perfect for tutorials, debugging demos, and sharing workflows
📋 Copy-able output + timing information

Get Pure Cinema: https://marketplace.visualstudio.com/items?itemName=pure-cinema

#coding #terminal #vscode #developer #tools`;

        await vscode.env.clipboard.writeText(shareText);
        
        const platformUrls: { [key: string]: string } = {
            'twitter': 'https://twitter.com/intent/tweet',
            'linkedin': 'https://www.linkedin.com/feed/',
            'github': 'https://github.com',
            'dev.to': 'https://dev.to/new'
        };

        const openChoice = await vscode.window.showInformationMessage(
            `Share text copied to clipboard! This promotes the recording concept rather than just copying terminal output.`,
            `Open ${platform.charAt(0).toUpperCase() + platform.slice(1)}`
        );

        if (openChoice && platformUrls[platform]) {
            vscode.env.openExternal(vscode.Uri.parse(platformUrls[platform]));
        }
    }

    private async shareToGitHubGist(recording: Recording, platform: string, originalUri: vscode.Uri): Promise<void> {
        try {
            // Get GitHub token
            const token = await this.getGitHubToken();
            if (!token) {
                return;
            }

            // Prepare files for gist
            const baseName = path.basename(originalUri.fsPath, '.pcr');
            const gistFiles = await this.prepareGistFiles(recording, baseName);
            
            // Create gist
            const gistUrl = await this.createGitHubGist(token, gistFiles, baseName);
            
            if (gistUrl) {
                const choice = await vscode.window.showInformationMessage(
                    `🎉 Recording shared to GitHub Gist!`,
                    'Open Gist',
                    'Copy URL',
                    'Share on ' + platform
                );

                switch (choice) {
                    case 'Open Gist':
                        vscode.env.openExternal(vscode.Uri.parse(gistUrl));
                        break;
                    case 'Copy URL':
                        await vscode.env.clipboard.writeText(gistUrl);
                        vscode.window.showInformationMessage('Gist URL copied to clipboard!');
                        break;
                    case 'Share on ' + platform:
                        await this.shareGistToSocial(gistUrl, platform, recording);
                        break;
                }
            }

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to share to GitHub Gist: ${error}`);
        }
    }

    private async getGitHubToken(): Promise<string | null> {
        // Try to get token from VS Code's built-in GitHub authentication
        try {
            const session = await vscode.authentication.getSession('github', ['gist'], { createIfNone: true });
            return session.accessToken;
        } catch (error) {
            // Fallback: ask user to provide token manually
            const choice = await vscode.window.showWarningMessage(
                'GitHub authentication failed. You can provide a Personal Access Token to share gists.',
                'Enter Token',
                'Learn How',
                'Cancel'
            );

            if (choice === 'Enter Token') {
                const token = await vscode.window.showInputBox({
                    prompt: 'Enter GitHub Personal Access Token (with gist scope)',
                    password: true,
                    placeHolder: 'ghp_...',
                    validateInput: (value) => {
                        if (!value || !value.startsWith('ghp_') && !value.startsWith('github_pat_')) {
                            return 'Please enter a valid GitHub Personal Access Token';
                        }
                        return null;
                    }
                });
                return token || null;
            } else if (choice === 'Learn How') {
                vscode.env.openExternal(vscode.Uri.parse('https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens'));
                return null;
            }
            
            return null;
        }
    }

    private async prepareGistFiles(recording: Recording, baseName: string): Promise<{ [filename: string]: { content: string } }> {
        const files: { [filename: string]: { content: string } } = {};

        // 1. Original recording data
        files[`${baseName}.pcr`] = {
            content: JSON.stringify(recording, null, 2)
        };

        // 2. Interactive HTML player
        const htmlOptions: ExportOptions = {
            format: 'html',
            includeControls: true,
            theme: 'dark'
        };
        
        files[`${baseName}-player.html`] = {
            content: this.generateHtmlExport(recording, htmlOptions)
        };

        // 3. README with instructions
        const duration = recording.endTime ? ((recording.endTime - recording.startTime) / 1000).toFixed(1) : '0.0';
        const commandCount = recording.frames.filter(frame => frame.type === 'input').length;
        
        files['README.md'] = {
            content: `# 🎬 Terminal Recording

**Duration:** ${duration} seconds  
**Commands:** ${commandCount}  
**Terminal:** ${recording.terminalInfo.name || 'Unknown'}  
**Created:** ${new Date(recording.startTime).toLocaleString()}

## 📁 Files

- \`${baseName}.pcr\` - Pure Cinema recording data (JSON format)
- \`${baseName}-player.html\` - Interactive web player (open in browser)

## 🎦 How to View

### Option 1: Interactive Player
1. Download \`${baseName}-player.html\`
2. Open in any web browser
3. Use playback controls to watch the session

### Option 2: VS Code Extension
1. Install [Pure Cinema](https://marketplace.visualstudio.com/items?itemName=pure-cinema) for VS Code
2. Download \`${baseName}.pcr\`
3. Use Command Palette: "Pure Cinema: Play Recording"

## 🚀 About Pure Cinema

Pure Cinema lets you record, edit, and share terminal sessions directly in VS Code. Perfect for:
- 📚 Creating tutorials and demos
- 🐛 Sharing debugging sessions
- 📖 Documenting command-line workflows
- 🎯 Code reviews and pair programming

**Features:**
- ✅ Records timing and input/output separately
- ✅ Text remains copyable in recordings  
- ✅ Cross-platform (Windows, macOS, Linux)
- ✅ 100% local and private - no data transmission
- ✅ Export to HTML, JSON, and more

---
*Recording created with [Pure Cinema](https://marketplace.visualstudio.com/items?itemName=pure-cinema) for VS Code*`
        };

        return files;
    }

    private async createGitHubGist(token: string, files: { [filename: string]: { content: string } }, baseName: string): Promise<string | null> {
        const gistData = {
            description: `🎬 Terminal Recording: ${baseName} (Created with Pure Cinema)`,
            public: false, // Private by default for safety
            files: files
        };

        return new Promise((resolve, reject) => {
            const postData = JSON.stringify(gistData);
            
            const options = {
                hostname: 'api.github.com',
                port: 443,
                path: '/gists',
                method: 'POST',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Pure-Cinema-VSCode-Extension',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = https.request(options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    try {
                        if (res.statusCode === 201) {
                            const result = JSON.parse(responseData);
                            resolve(result.html_url);
                        } else {
                            const errorData = JSON.parse(responseData);
                            reject(new Error(`GitHub API error: ${res.statusCode} - ${errorData.message || 'Unknown error'}`));
                        }
                    } catch (parseError) {
                        reject(new Error(`Failed to parse GitHub API response: ${parseError}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Network error creating gist: ${error.message}`));
            });

            req.write(postData);
            req.end();
        });
    }

    private async shareGistToSocial(gistUrl: string, platform: string, recording: Recording): Promise<void> {
        const duration = recording.endTime ? ((recording.endTime - recording.startTime) / 1000).toFixed(1) : '0.0';
        const commandCount = recording.frames.filter(frame => frame.type === 'input').length;
        
        const shareTexts: { [key: string]: string } = {
            'twitter': `🎬 Just shared a ${duration}s terminal recording with ${commandCount} commands!\n\n✨ Interactive playback with Pure Cinema for VS Code\n🔗 ${gistUrl}\n\n#coding #terminal #vscode #developer`,
            'linkedin': `I just created an interactive terminal recording (${duration}s, ${commandCount} commands) using Pure Cinema for VS Code. Perfect for sharing debugging sessions and tutorials!\n\n${gistUrl}\n\n#coding #vscode #developertools`,
            'github': `🎬 Terminal Recording\n\nDuration: ${duration}s | Commands: ${commandCount}\nCreated with Pure Cinema for VS Code\n\n${gistUrl}`,
            'dev.to': `# 🎬 Terminal Recording\n\nJust shared a ${duration}s terminal session with ${commandCount} commands using Pure Cinema!\n\n[View Interactive Recording](${gistUrl})\n\nPure Cinema lets you record terminal sessions directly in VS Code with:\n- Interactive playback controls\n- Copy-able text output\n- Cross-platform support\n- 100% local and private\n\n#vscode #terminal #coding`
        };

        const shareText = shareTexts[platform] || shareTexts['github'];
        await vscode.env.clipboard.writeText(shareText);

        const platformUrls: { [key: string]: string } = {
            'twitter': `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
            'linkedin': 'https://www.linkedin.com/feed/',
            'github': 'https://github.com',
            'dev.to': `https://dev.to/new?prefill=---%0Atitle: ${encodeURIComponent('Terminal Recording')}%0Apublished: false%0A---%0A%0A${encodeURIComponent(shareText)}`
        };

        const choice = await vscode.window.showInformationMessage(
            `Share text copied to clipboard! Ready to post on ${platform}.`,
            `Open ${platform.charAt(0).toUpperCase() + platform.slice(1)}`
        );

        if (choice && platformUrls[platform]) {
            vscode.env.openExternal(vscode.Uri.parse(platformUrls[platform]));
        }
    }

    private async exportHtmlForManualSharing(recording: Recording, platform: string, originalUri: vscode.Uri): Promise<void> {
        const exportOptions: ExportOptions = {
            format: 'html',
            includeControls: true,
            theme: 'dark',
            socialPlatform: platform as any
        };

        const baseName = path.basename(originalUri.fsPath, '.pcr');
        const htmlPath = path.join(path.dirname(originalUri.fsPath), `${baseName}-share.html`);
        const htmlContent = this.generateHtmlExport(recording, exportOptions);
        
        try {
            await fs.promises.writeFile(htmlPath, htmlContent, 'utf8');
            
            await vscode.window.showInformationMessage(
                `HTML file created! Upload to GitHub Pages, Netlify, or any web host, then share the URL on ${platform}.`,
                'Open HTML File',
                'Open Folder'
            ).then(choice => {
                if (choice === 'Open HTML File') {
                    vscode.env.openExternal(vscode.Uri.file(htmlPath));
                } else if (choice === 'Open Folder') {
                    vscode.env.openExternal(vscode.Uri.file(path.dirname(htmlPath)));
                }
            });
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create HTML file: ${error}`);
        }
    }

    private getExportWebviewContent(recording: Recording): string {
        const duration = recording.endTime ? recording.endTime - recording.startTime : 0;
        const durationSeconds = (duration / 1000).toFixed(1);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Export Recording - Pure Cinema</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            margin: 0;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        
        .export-container {
            max-width: 800px;
            margin: 0 auto;
        }
        
        .section {
            margin-bottom: 25px;
            padding: 20px;
            background-color: var(--vscode-textBlockQuote-background);
            border-radius: 8px;
            border-left: 4px solid var(--vscode-textBlockQuote-border);
        }
        
        .section h3 {
            margin-top: 0;
            color: var(--vscode-textPreformat-foreground);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .form-group {
            margin-bottom: 15px;
        }
        
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: bold;
        }
        
        select, input {
            width: 100%;
            padding: 10px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
            font-size: 14px;
        }
        
        .radio-group {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
        }
        
        .radio-option {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            margin-right: 10px;
            font-size: 14px;
            font-weight: bold;
            transition: all 0.2s;
        }
        
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
            transform: translateY(-1px);
        }
        
        .preview-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .preview-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .actions {
            text-align: center;
            margin-top: 30px;
            padding: 20px;
            background-color: var(--vscode-textCodeBlock-background);
            border-radius: 8px;
        }
        
        .info-box {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
            border: 1px solid var(--vscode-panel-border);
        }
        
        .social-buttons {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        
        .social-button {
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            cursor: pointer;
            transition: transform 0.2s;
            border: 2px solid transparent;
        }
        
        .social-button:hover {
            transform: translateY(-2px);
            border-color: var(--vscode-focusBorder);
        }
        
        .twitter { background: linear-gradient(135deg, #1da1f2, #1a91da); }
        .linkedin { background: linear-gradient(135deg, #0077b5, #005885); }
        .github { background: linear-gradient(135deg, #333, #24292e); }
        .devto { background: linear-gradient(135deg, #0a0a0a, #000); }
        
        .social-button {
            color: white;
            font-weight: bold;
        }
        
        .format-description {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 5px;
        }
        
        .warning {
            background-color: var(--vscode-inputValidation-warningBackground);
            color: var(--vscode-inputValidation-warningForeground);
            padding: 12px;
            border-radius: 6px;
            border: 1px solid var(--vscode-inputValidation-warningBorder);
            margin-bottom: 15px;
        }
    </style>
</head>
<body>
    <div class="export-container">
        <h2>🚀 Export & Share Recording</h2>
        
        <div class="info-box">
            <strong>Recording Info:</strong> ${durationSeconds}s duration • ${recording.frames.length} frames • ${recording.terminalInfo.name || 'Unknown terminal'}
        </div>
        
        <div class="section">
            <h3>📄 Export Format</h3>
            <div class="form-group">
                <label for="exportFormat">Choose export format:</label>
                <select id="exportFormat" onchange="updateFormatDescription()">
                    <option value="html">HTML (Interactive Web Page)</option>
                    <option value="json">JSON (Raw Data)</option>
                    <option value="gif">GIF Animation (Coming Soon)</option>
                    <option value="mp4">MP4 Video (Coming Soon)</option>
                </select>
                <div id="formatDescription" class="format-description">
                    Creates a fully interactive web page that can be shared online with playback controls.
                </div>
            </div>
        </div>
        
        <div class="section">
            <h3>🎨 Export Options</h3>
            <div class="form-group">
                <label>Theme:</label>
                <div class="radio-group">
                    <div class="radio-option">
                        <input type="radio" id="themeDark" name="theme" value="dark" checked>
                        <label for="themeDark">Dark</label>
                    </div>
                    <div class="radio-option">
                        <input type="radio" id="themeLight" name="theme" value="light">
                        <label for="themeLight">Light</label>
                    </div>
                    <div class="radio-option">
                        <input type="radio" id="themeAuto" name="theme" value="auto">
                        <label for="themeAuto">Auto</label>
                    </div>
                </div>
            </div>
            
            <div class="form-group">
                <div class="radio-option">
                    <input type="checkbox" id="includeControls" checked>
                    <label for="includeControls">Include playback controls</label>
                </div>
            </div>
        </div>
        
        <div class="section">
            <h3>📱 Quick Share to Social</h3>
            <p>Export and get ready-to-share content for your favorite platforms:</p>
            <div class="social-buttons">
                <div class="social-button twitter" onclick="shareToSocial('twitter')">
                    <div>📱 Twitter</div>
                    <small>Perfect for code snippets</small>
                </div>
                <div class="social-button linkedin" onclick="shareToSocial('linkedin')">
                    <div>💼 LinkedIn</div>
                    <small>Professional sharing</small>
                </div>
                <div class="social-button github" onclick="shareToSocial('github')">
                    <div>🐙 GitHub</div>
                    <small>Documentation & issues</small>
                </div>
                <div class="social-button devto" onclick="shareToSocial('dev.to')">
                    <div>👩‍💻 DEV Community</div>
                    <small>Technical blog posts</small>
                </div>
            </div>
        </div>
        
        <div class="warning">
            <strong>🔒 Privacy Note:</strong> All exports are generated locally on your machine. For social sharing, you'll need to upload the exported file to a web hosting service.
        </div>
        
        <div class="actions">
            <button class="preview-button" onclick="previewExport()">👁️ Preview Export</button>
            <button onclick="exportRecording()">💾 Export File</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function updateFormatDescription() {
            const format = document.getElementById('exportFormat').value;
            const description = document.getElementById('formatDescription');
            
            const descriptions = {
                html: 'Creates a fully interactive web page that can be shared online with playback controls.',
                json: 'Exports the raw recording data in JSON format for programmatic use.',
                gif: 'Animated GIF suitable for embedding in documentation (requires additional processing).',
                mp4: 'Video file that can be uploaded to video platforms (requires additional processing).'
            };
            
            description.textContent = descriptions[format] || '';
        }
        
        function getExportOptions() {
            return {
                format: document.getElementById('exportFormat').value,
                theme: document.querySelector('input[name="theme"]:checked').value,
                includeControls: document.getElementById('includeControls').checked
            };
        }
        
        function previewExport() {
            vscode.postMessage({
                command: 'preview',
                options: getExportOptions()
            });
        }
        
        function exportRecording() {
            vscode.postMessage({
                command: 'export',
                options: getExportOptions()
            });
        }
        
        function shareToSocial(platform) {
            vscode.postMessage({
                command: 'shareToSocial',
                platform: platform
            });
        }
        
        // Initialize
        updateFormatDescription();
    </script>
</body>
</html>`;
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
    }
}