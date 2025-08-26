import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface RecordingFrame {
    timestamp: number;
    content: string;
    type: 'output' | 'input';
}

export interface Recording {
    version: string;
    startTime: number;
    endTime?: number;
    frames: RecordingFrame[];
    terminalInfo: {
        name?: string;
        cwd?: string;
        shellPath?: string;
    };
    dimensions?: {
        width: number;
        height: number;
    };
}

export class TerminalRecorder implements vscode.Disposable {
    private isRecording = false;
    private currentRecording: Recording | null = null;
    private disposables: vscode.Disposable[] = [];
    private writeEmitterListener: vscode.Disposable | undefined;
    private activeTerminal: vscode.Terminal | undefined;
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.disposables.push(this.statusBarItem);
    }

    public async startRecording(): Promise<void> {
        if (this.isRecording) {
            vscode.window.showWarningMessage('Recording is already in progress');
            return;
        }

        // We'll create our own terminal for recording instead of using existing ones
        // This ensures we can capture all input/output properly

        // Privacy confirmation dialog
        const confirmed = await vscode.window.showInformationMessage(
            'Pure Cinema will record terminal output locally on your machine. No data is transmitted externally. Continue?',
            { modal: true },
            'Start Recording',
            'Cancel'
        );

        if (confirmed !== 'Start Recording') {
            return;
        }

        this.isRecording = true;
        const startTime = Date.now();
        
        this.currentRecording = {
            version: '1.0',
            startTime,
            frames: [],
            terminalInfo: {
                name: 'Pure Cinema Recording Terminal',
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd(),
                shellPath: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash'
            }
        };

        // Set context for menu visibility
        vscode.commands.executeCommand('setContext', 'pure-cinema.recording', true);

        // Update status bar with privacy reminder
        this.statusBarItem.text = '$(record) Recording... (Local Only)';
        this.statusBarItem.tooltip = 'Pure Cinema is recording terminal session locally on your machine. Click to stop recording.';
        this.statusBarItem.command = 'pure-cinema.stopRecording';
        this.statusBarItem.show();

        // Create and start recording terminal
        this.startListeningToTerminal();

        vscode.window.showInformationMessage('Started recording terminal session');
    }

    private startListeningToTerminal(): void {
        // Create our own pseudoterminal to capture both input and output
        this.createRecordingTerminal();
    }

    private createRecordingTerminal(): void {
        const writeEmitter = new vscode.EventEmitter<string>();
        let currentLine = '';
        
        const pty: vscode.Pseudoterminal = {
            onDidWrite: writeEmitter.event,
            open: () => {
                // Initialize with a prompt
                const prompt = 'Recording Terminal $ ';
                writeEmitter.fire(prompt);
                if (this.currentRecording) {
                    this.currentRecording.frames.push({
                        timestamp: Date.now() - this.currentRecording.startTime,
                        content: prompt,
                        type: 'output'
                    });
                }
            },
            close: () => {},
            handleInput: (data: string) => {
                if (!this.currentRecording || !this.isRecording) {
                    return;
                }

                const timestamp = Date.now() - this.currentRecording.startTime;

                if (data === '\r') {
                    // Enter pressed - execute command
                    writeEmitter.fire('\r\n');
                    
                    // Record the enter
                    this.currentRecording.frames.push({
                        timestamp,
                        content: '\r\n',
                        type: 'output'
                    });

                    // Process and execute the command
                    this.executeCommand(currentLine, writeEmitter);
                    currentLine = '';

                    // Show new prompt
                    setTimeout(() => {
                        const prompt = 'Recording Terminal $ ';
                        writeEmitter.fire(prompt);
                        if (this.currentRecording) {
                            this.currentRecording.frames.push({
                                timestamp: Date.now() - this.currentRecording.startTime,
                                content: prompt,
                                type: 'output'
                            });
                        }
                    }, 100);
                } else if (data === '\x7f') {
                    // Backspace
                    if (currentLine.length > 0) {
                        currentLine = currentLine.slice(0, -1);
                        writeEmitter.fire('\b \b');
                        this.currentRecording.frames.push({
                            timestamp,
                            content: '\b \b',
                            type: 'output'
                        });
                    }
                } else {
                    // Regular character
                    currentLine += data;
                    writeEmitter.fire(data);
                    this.currentRecording.frames.push({
                        timestamp,
                        content: data,
                        type: 'input'
                    });
                }
            }
        };

        // Create a new terminal with our pseudoterminal
        const recordingTerminal = vscode.window.createTerminal({
            name: 'Pure Cinema Recording',
            pty: pty
        });
        
        recordingTerminal.show();
        this.activeTerminal = recordingTerminal;
    }

    private executeCommand(command: string, writeEmitter: vscode.EventEmitter<string>): void {
        if (!this.currentRecording) return;

        const timestamp = Date.now() - this.currentRecording.startTime;
        let output = '';

        // Simple command simulation
        switch (command.trim()) {
            case 'ls':
                output = 'example.txt  package.json  src  test-recording.pcr\r\n';
                break;
            case 'pwd':
                output = '/home/user/demo\r\n';
                break;
            case 'date':
                output = new Date().toString() + '\r\n';
                break;
            case 'whoami':
                output = 'user\r\n';
                break;
            case 'help':
                output = 'Available commands: ls, pwd, date, whoami, help, echo, clear, exit\r\n';
                break;
            case 'clear':
                output = '\x1b[2J\x1b[H'; // ANSI clear screen
                break;
            case 'exit':
                output = 'Recording session ended. Use Pure Cinema: Stop Recording to save.\r\n';
                break;
            default:
                if (command.startsWith('echo ')) {
                    output = command.substring(5) + '\r\n';
                } else if (command.trim() === '') {
                    output = '';
                } else {
                    output = `Command not found: ${command}\r\nTry 'help' for available commands.\r\n`;
                }
        }

        if (output) {
            writeEmitter.fire(output);
            this.currentRecording.frames.push({
                timestamp: timestamp + 50,
                content: output,
                type: 'output'
            });
        }
    }

    public async stopRecording(): Promise<void> {
        if (!this.isRecording || !this.currentRecording) {
            vscode.window.showWarningMessage('No recording in progress');
            return;
        }

        this.isRecording = false;
        this.currentRecording.endTime = Date.now();

        // Clear context and status bar
        vscode.commands.executeCommand('setContext', 'pure-cinema.recording', false);
        this.statusBarItem.hide();

        // Save recording
        await this.saveRecording();
        
        // Clean up
        if (this.writeEmitterListener) {
            this.writeEmitterListener.dispose();
            this.writeEmitterListener = undefined;
        }

        vscode.window.showInformationMessage('Recording stopped and saved');
    }

    private async saveRecording(): Promise<void> {
        if (!this.currentRecording) {return;}

        const saveUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`recording-${new Date().toISOString().replace(/[:.]/g, '-')}.pcr`),
            filters: {
                'Pure Cinema Recordings': ['pcr']
            }
        });

        if (!saveUri) {return;}

        try {
            const recordingData = JSON.stringify(this.currentRecording, null, 2);
            await fs.promises.writeFile(saveUri.fsPath, recordingData, 'utf8');
            vscode.window.showInformationMessage(`Recording saved to ${path.basename(saveUri.fsPath)}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to save recording: ${error}`);
        }

        this.currentRecording = null;
    }

    dispose(): void {
        if (this.isRecording) {
            this.stopRecording();
        }
        this.disposables.forEach(d => d.dispose());
    }
}