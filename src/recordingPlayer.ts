import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Recording, RecordingFrame } from './terminalRecorder';
import { RecordingExporter } from './recordingExporter';

export class RecordingPlayer implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    private exporter: RecordingExporter;

    constructor() {
        this.exporter = new RecordingExporter();
    }

    public async playRecording(uri: vscode.Uri): Promise<void> {
        try {
            const content = await fs.promises.readFile(uri.fsPath, 'utf8');
            const recording: Recording = JSON.parse(content);
            
            await this.showRecordingViewer(recording);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load recording: ${error}`);
        }
    }

    private async showRecordingViewer(recording: Recording): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'pure-cinema-player',
            'Pure Cinema Player',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: []
            }
        );

        panel.webview.html = this.getWebviewContent(recording);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'copy':
                        vscode.env.clipboard.writeText(message.text);
                        vscode.window.showInformationMessage('Text copied to clipboard');
                        break;
                    case 'export':
                        await this.exportRecording(recording);
                        break;
                }
            },
            undefined,
            this.disposables
        );

        this.disposables.push(panel);
    }

    private getWebviewContent(recording: Recording): string {
        const duration = recording.endTime ? recording.endTime - recording.startTime : 0;
        const durationSeconds = (duration / 1000).toFixed(1);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pure Cinema Player</title>
    <style>
        body {
            font-family: 'Courier New', monospace;
            margin: 0;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        
        .player-container {
            max-width: 100%;
            margin: 0 auto;
        }
        
        .recording-info {
            background-color: var(--vscode-textBlockQuote-background);
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            border-left: 3px solid var(--vscode-textBlockQuote-border);
        }
        
        .recording-info h3 {
            margin: 0 0 10px 0;
            color: var(--vscode-textPreformat-foreground);
        }
        
        .controls {
            margin-bottom: 20px;
            display: flex;
            gap: 10px;
            align-items: center;
        }
        
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 14px;
        }
        
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
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
            background-color: var(--vscode-progressBar-background);
            border-radius: 3px;
            cursor: pointer;
        }
        
        .progress-fill {
            height: 100%;
            background-color: var(--vscode-progressBar-background);
            border-radius: 3px;
            transition: width 0.1s ease;
        }
        
        .terminal-output {
            background-color: #0f0f23;
            color: #f8f8f2;
            padding: 20px;
            border-radius: 8px;
            font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', Consolas, 'Liberation Mono', monospace;
            font-size: 14px;
            line-height: 1.5;
            white-space: pre-wrap;
            overflow-y: auto;
            max-height: 600px;
            border: 1px solid #44475a;
            user-select: text;
            cursor: text;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
        
        .terminal-output:hover {
            border-color: #6272a4;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        }
        
        .copy-button {
            position: absolute;
            top: 10px;
            right: 10px;
            padding: 4px 8px;
            font-size: 12px;
        }
        
        .output-container {
            position: relative;
        }
        
        .time-display {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="player-container">
        <div class="recording-info">
            <h3>Recording Information</h3>
            <p><strong>Terminal:</strong> ${recording.terminalInfo.name || 'Unknown'}</p>
            <p><strong>Duration:</strong> ${durationSeconds}s</p>
            <p><strong>Frames:</strong> ${recording.frames.length}</p>
            ${recording.terminalInfo.cwd ? `<p><strong>Working Directory:</strong> ${recording.terminalInfo.cwd}</p>` : ''}
        </div>
        
        <div class="controls">
            <button id="playBtn">▶ Play</button>
            <button id="pauseBtn" disabled>⏸ Pause</button>
            <button id="resetBtn">⏮ Reset</button>
            <label style="display: flex; align-items: center; gap: 5px; margin-left: 10px;">
                <input type="checkbox" id="removeDeadTimeToggle" style="margin: 0;">
                <span style="font-size: 12px; color: var(--vscode-descriptionForeground);">Remove extra time between keypresses</span>
            </label>
            <div class="progress-container">
                <div class="progress-bar" id="progressBar">
                    <div class="progress-fill" id="progressFill"></div>
                </div>
            </div>
            <span class="time-display" id="timeDisplay">0.0s / ${durationSeconds}s</span>
        </div>
        
        <div class="output-container">
            <div class="terminal-output" id="terminalOutput"></div>
            <button class="copy-button" id="copyBtn">📋 Copy All</button>
            <button class="copy-button" id="exportBtn" style="top: 50px;">🚀 Export</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const originalRecording = ${JSON.stringify(recording)};
        
        let isPlaying = false;
        let currentFrame = 0;
        let playbackSpeed = 1.0;
        let animationId = null;
        let processedRecording = originalRecording;
        
        const playBtn = document.getElementById('playBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const resetBtn = document.getElementById('resetBtn');
        const removeDeadTimeToggle = document.getElementById('removeDeadTimeToggle');
        const progressBar = document.getElementById('progressBar');
        const progressFill = document.getElementById('progressFill');
        const timeDisplay = document.getElementById('timeDisplay');
        const terminalOutput = document.getElementById('terminalOutput');
        const copyBtn = document.getElementById('copyBtn');
        
        let outputContent = '';
        
        function removeDeadTime(frames) {
            if (frames.length <= 1) {
                return frames;
            }

            const processedFrames = [];
            const DEAD_TIME_THRESHOLD = 3000; // 3 seconds of inactivity
            const MAX_PAUSE_DURATION = 1000;  // Compress long pauses to max 1 second
            
            let cumulativeTimeReduction = 0;
            
            for (let i = 0; i < frames.length; i++) {
                const currentFrame = frames[i];
                const adjustedFrame = {
                    ...currentFrame,
                    timestamp: currentFrame.timestamp - cumulativeTimeReduction
                };
                
                processedFrames.push(adjustedFrame);
                
                // Check for dead time between this frame and the next
                if (i < frames.length - 1) {
                    const nextFrame = frames[i + 1];
                    const timeBetweenFrames = nextFrame.timestamp - currentFrame.timestamp;
                    
                    if (timeBetweenFrames > DEAD_TIME_THRESHOLD) {
                        // Compress the dead time
                        const timeReduction = timeBetweenFrames - MAX_PAUSE_DURATION;
                        cumulativeTimeReduction += timeReduction;
                    }
                }
            }
            
            return processedFrames;
        }
        
        function updateProcessedRecording() {
            if (removeDeadTimeToggle.checked) {
                processedRecording = {
                    ...originalRecording,
                    frames: removeDeadTime(originalRecording.frames)
                };
            } else {
                processedRecording = originalRecording;
            }
        }
        
        function updateDisplay() {
            terminalOutput.textContent = outputContent;
            
            if (processedRecording.frames.length > 0) {
                const progress = (currentFrame / processedRecording.frames.length) * 100;
                progressFill.style.width = progress + '%';
                
                const currentTime = currentFrame > 0 ? (processedRecording.frames[currentFrame - 1].timestamp / 1000).toFixed(1) : '0.0';
                const totalTime = processedRecording.frames.length > 0 ? 
                    (processedRecording.frames[processedRecording.frames.length - 1].timestamp / 1000).toFixed(1) : '0.0';
                timeDisplay.textContent = currentTime + 's / ' + totalTime + 's';
            }
        }
        
        function playRecording() {
            if (currentFrame >= processedRecording.frames.length) {
                isPlaying = false;
                playBtn.disabled = false;
                pauseBtn.disabled = true;
                return;
            }
            
            const frame = processedRecording.frames[currentFrame];
            if (frame.type === 'output' || frame.type === 'input') {
                outputContent += frame.content;
            }
            
            currentFrame++;
            updateDisplay();
            
            if (isPlaying && currentFrame < processedRecording.frames.length) {
                const nextFrame = processedRecording.frames[currentFrame];
                const delay = Math.max(50, nextFrame.timestamp - frame.timestamp);
                
                setTimeout(() => {
                    if (isPlaying) {
                        playRecording();
                    }
                }, delay);
            } else if (currentFrame >= processedRecording.frames.length) {
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
        
        removeDeadTimeToggle.addEventListener('change', () => {
            const wasPlaying = isPlaying;
            if (isPlaying) {
                isPlaying = false;
                playBtn.disabled = false;
                pauseBtn.disabled = true;
            }
            
            updateProcessedRecording();
            
            // Reset playback
            currentFrame = 0;
            outputContent = '';
            updateDisplay();
        });
        
        copyBtn.addEventListener('click', () => {
            vscode.postMessage({
                command: 'copy',
                text: outputContent
            });
        });
        
        const exportBtn = document.getElementById('exportBtn');
        exportBtn.addEventListener('click', () => {
            vscode.postMessage({
                command: 'export'
            });
        });
        
        progressBar.addEventListener('click', (e) => {
            const rect = progressBar.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const progress = clickX / rect.width;
            
            currentFrame = Math.floor(progress * processedRecording.frames.length);
            
            // Rebuild output up to current frame
            outputContent = '';
            for (let i = 0; i < currentFrame; i++) {
                const frame = processedRecording.frames[i];
                if (frame.type === 'output' || frame.type === 'input') {
                    outputContent += frame.content;
                }
            }
            
            updateDisplay();
        });
        
        // Initialize
        updateProcessedRecording();
        updateDisplay();
    </script>
</body>
</html>`;
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.exporter.dispose();
    }

    private async exportRecording(recording: Recording): Promise<void> {
        // Create a temporary URI for the recording
        const tempPath = path.join(os.tmpdir(), `recording-${Date.now()}.pcr`);
        const tempUri = vscode.Uri.file(tempPath);
        
        try {
            // Write recording to temp file
            const recordingData = JSON.stringify(recording, null, 2);
            await fs.promises.writeFile(tempPath, recordingData, 'utf8');
            
            // Use exporter to handle export
            await this.exporter.exportRecording(tempUri);
            
            // Clean up temp file
            await fs.promises.unlink(tempPath);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to export recording: ${error}`);
        }
    }
}