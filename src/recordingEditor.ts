import * as vscode from 'vscode';
import * as fs from 'fs';
import { Recording, RecordingFrame } from './terminalRecorder';

export class RecordingEditor implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];

    constructor() {}

    public async editRecording(uri: vscode.Uri): Promise<void> {
        try {
            const content = await fs.promises.readFile(uri.fsPath, 'utf8');
            const recording: Recording = JSON.parse(content);
            
            await this.showRecordingEditor(recording, uri);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load recording for editing: ${error}`);
        }
    }

    private async showRecordingEditor(recording: Recording, originalUri: vscode.Uri): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'pure-cinema-editor',
            'Pure Cinema Editor',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: []
            }
        );

        panel.webview.html = this.getEditorWebviewContent(recording);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'preview':
                        await this.previewEdits(recording, message.edits);
                        break;
                    case 'save':
                        await this.saveEditedRecording(recording, message.edits, originalUri);
                        break;
                    case 'saveAs':
                        await this.saveAsEditedRecording(recording, message.edits);
                        break;
                }
            },
            undefined,
            this.disposables
        );

        this.disposables.push(panel);
    }

    private async previewEdits(recording: Recording, edits: any): Promise<void> {
        const editedRecording = this.applyEdits(recording, edits);
        
        // Create a temporary preview
        const { RecordingPlayer } = await import('./recordingPlayer');
        const player = new RecordingPlayer();
        
        // Show preview in a new panel
        const previewPanel = vscode.window.createWebviewPanel(
            'pure-cinema-preview',
            'Preview - Pure Cinema',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                localResourceRoots: []
            }
        );

        // Use the player's webview content generation
        previewPanel.webview.html = this.getPreviewWebviewContent(editedRecording);
        
        this.disposables.push(previewPanel);
    }

    private async saveEditedRecording(recording: Recording, edits: any, originalUri: vscode.Uri): Promise<void> {
        const editedRecording = this.applyEdits(recording, edits);
        
        try {
            const recordingData = JSON.stringify(editedRecording, null, 2);
            await fs.promises.writeFile(originalUri.fsPath, recordingData, 'utf8');
            vscode.window.showInformationMessage('Recording updated successfully');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to save recording: ${error}`);
        }
    }

    private async saveAsEditedRecording(recording: Recording, edits: any): Promise<void> {
        const editedRecording = this.applyEdits(recording, edits);
        
        const saveUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`edited-recording-${new Date().toISOString().replace(/[:.]/g, '-')}.pcr`),
            filters: {
                'Pure Cinema Recordings': ['pcr']
            }
        });

        if (!saveUri) {return;}

        try {
            const recordingData = JSON.stringify(editedRecording, null, 2);
            await fs.promises.writeFile(saveUri.fsPath, recordingData, 'utf8');
            vscode.window.showInformationMessage(`Edited recording saved as ${saveUri.fsPath}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to save recording: ${error}`);
        }
    }

    private applyEdits(recording: Recording, edits: any): Recording {
        const editedRecording: Recording = JSON.parse(JSON.stringify(recording));

        // Apply dimension changes
        if (edits.dimensions) {
            editedRecording.dimensions = {
                width: parseInt(edits.dimensions.width) || 80,
                height: parseInt(edits.dimensions.height) || 24
            };
        }

        // Apply timeline trimming
        if (edits.timeline) {
            const startTrim = parseFloat(edits.timeline.startTime) || 0;
            const endTrim = parseFloat(edits.timeline.endTime) || Number.MAX_SAFE_INTEGER;
            
            // Filter frames within the trimmed range
            editedRecording.frames = recording.frames.filter(frame => 
                frame.timestamp >= startTrim && frame.timestamp <= endTrim
            );

            // Adjust timestamps to start from 0
            if (editedRecording.frames.length > 0) {
                const firstFrameTime = editedRecording.frames[0].timestamp;
                editedRecording.frames.forEach(frame => {
                    frame.timestamp -= firstFrameTime;
                });

                // Update recording times
                editedRecording.startTime = recording.startTime + startTrim;
                if (recording.endTime) {
                    editedRecording.endTime = Math.min(recording.endTime, recording.startTime + endTrim);
                }
            }
        }

        return editedRecording;
    }

    private getEditorWebviewContent(recording: Recording): string {
        const duration = recording.endTime ? recording.endTime - recording.startTime : 0;
        const durationSeconds = (duration / 1000).toFixed(1);
        const currentDimensions = recording.dimensions || { width: 80, height: 24 };

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pure Cinema Editor</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            margin: 0;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        
        .editor-container {
            max-width: 800px;
            margin: 0 auto;
        }
        
        .section {
            margin-bottom: 30px;
            padding: 20px;
            background-color: var(--vscode-textBlockQuote-background);
            border-radius: 5px;
            border-left: 3px solid var(--vscode-textBlockQuote-border);
        }
        
        .section h3 {
            margin-top: 0;
            color: var(--vscode-textPreformat-foreground);
        }
        
        .form-group {
            margin-bottom: 15px;
        }
        
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        
        input, select {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 3px;
        }
        
        .dimension-inputs {
            display: flex;
            gap: 10px;
        }
        
        .dimension-inputs .form-group {
            flex: 1;
        }
        
        .timeline-inputs {
            display: flex;
            gap: 10px;
        }
        
        .timeline-inputs .form-group {
            flex: 1;
        }
        
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            border-radius: 3px;
            cursor: pointer;
            margin-right: 10px;
            font-size: 14px;
        }
        
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
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
        }
        
        .info {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 10px;
            border-radius: 3px;
            margin-bottom: 15px;
            font-family: monospace;
        }
        
        .warning {
            background-color: var(--vscode-inputValidation-warningBackground);
            color: var(--vscode-inputValidation-warningForeground);
            padding: 10px;
            border-radius: 3px;
            margin-bottom: 15px;
            border: 1px solid var(--vscode-inputValidation-warningBorder);
        }
    </style>
</head>
<body>
    <div class="editor-container">
        <h2>Edit Recording</h2>
        
        <div class="info">
            <strong>Original Recording:</strong><br>
            Duration: ${durationSeconds}s | Frames: ${recording.frames.length} | Terminal: ${recording.terminalInfo.name || 'Unknown'}
        </div>
        
        <div class="section">
            <h3>📐 Dimensions</h3>
            <p>Change the display dimensions of the terminal recording.</p>
            <div class="dimension-inputs">
                <div class="form-group">
                    <label for="width">Width (characters):</label>
                    <input type="number" id="width" value="${currentDimensions.width}" min="20" max="200">
                </div>
                <div class="form-group">
                    <label for="height">Height (lines):</label>
                    <input type="number" id="height" value="${currentDimensions.height}" min="5" max="100">
                </div>
            </div>
        </div>
        
        <div class="section">
            <h3>✂️ Timeline Trimming</h3>
            <p>Trim the start and end points of your recording.</p>
            <div class="timeline-inputs">
                <div class="form-group">
                    <label for="startTime">Start Time (seconds):</label>
                    <input type="number" id="startTime" value="0" min="0" max="${parseFloat(durationSeconds)}" step="0.1">
                </div>
                <div class="form-group">
                    <label for="endTime">End Time (seconds):</label>
                    <input type="number" id="endTime" value="${durationSeconds}" min="0" max="${parseFloat(durationSeconds)}" step="0.1">
                </div>
            </div>
        </div>
        
        <div class="warning">
            <strong>⚠️ Privacy Notice:</strong> All editing happens locally on your machine. No data is transmitted externally.
        </div>
        
        <div class="actions">
            <button class="preview-button" onclick="previewChanges()">👁️ Preview Changes</button>
            <button onclick="saveChanges()">💾 Save Changes</button>
            <button onclick="saveAsNew()">📁 Save As New File</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function getEdits() {
            return {
                dimensions: {
                    width: document.getElementById('width').value,
                    height: document.getElementById('height').value
                },
                timeline: {
                    startTime: parseFloat(document.getElementById('startTime').value) * 1000, // Convert to milliseconds
                    endTime: parseFloat(document.getElementById('endTime').value) * 1000
                }
            };
        }
        
        function previewChanges() {
            vscode.postMessage({
                command: 'preview',
                edits: getEdits()
            });
        }
        
        function saveChanges() {
            vscode.postMessage({
                command: 'save',
                edits: getEdits()
            });
        }
        
        function saveAsNew() {
            vscode.postMessage({
                command: 'saveAs',
                edits: getEdits()
            });
        }
        
        // Validate timeline inputs
        document.getElementById('startTime').addEventListener('input', function() {
            const startTime = parseFloat(this.value);
            const endTime = parseFloat(document.getElementById('endTime').value);
            
            if (startTime >= endTime) {
                document.getElementById('endTime').value = (startTime + 0.1).toFixed(1);
            }
        });
        
        document.getElementById('endTime').addEventListener('input', function() {
            const startTime = parseFloat(document.getElementById('startTime').value);
            const endTime = parseFloat(this.value);
            
            if (endTime <= startTime) {
                document.getElementById('startTime').value = Math.max(0, endTime - 0.1).toFixed(1);
            }
        });
    </script>
</body>
</html>`;
    }

    private getPreviewWebviewContent(recording: Recording): string {
        // Reuse the player's HTML generation logic with modifications for preview
        const duration = recording.endTime ? recording.endTime - recording.startTime : 0;
        const durationSeconds = (duration / 1000).toFixed(1);
        const dimensions = recording.dimensions || { width: 80, height: 24 };

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview - Pure Cinema</title>
    <style>
        body {
            font-family: 'Courier New', monospace;
            margin: 0;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        
        .preview-info {
            background-color: var(--vscode-textBlockQuote-background);
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            border-left: 3px solid var(--vscode-progressBar-background);
        }
        
        .terminal-output {
            background-color: #1e1e1e;
            color: #d4d4d4;
            padding: 20px;
            border-radius: 5px;
            font-family: 'Courier New', Consolas, 'Liberation Mono', monospace;
            font-size: 14px;
            line-height: 1.4;
            white-space: pre-wrap;
            overflow: auto;
            max-height: 400px;
            border: 1px solid var(--vscode-panel-border);
            width: ${dimensions.width * 8}px;
            height: ${dimensions.height * 16}px;
        }
    </style>
</head>
<body>
    <div class="preview-info">
        <h3>🔍 Preview</h3>
        <p><strong>Edited Duration:</strong> ${durationSeconds}s</p>
        <p><strong>Edited Dimensions:</strong> ${dimensions.width} x ${dimensions.height}</p>
        <p><strong>Frames:</strong> ${recording.frames.length}</p>
    </div>
    
    <div class="terminal-output" id="terminalOutput">
        ${recording.frames.map(frame => frame.type === 'output' ? frame.content : '').join('')}
    </div>
</body>
</html>`;
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
    }
}