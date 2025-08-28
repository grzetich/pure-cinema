import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

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
    private shellProcess: ChildProcess | null = null;
    private writeEmitter: vscode.EventEmitter<string> | null = null;
    private currentCommandBuffer: string = '';

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.disposables.push(this.statusBarItem);
    }

    public async startRecording(): Promise<void> {
        if (this.isRecording) {
            vscode.window.showWarningMessage('Recording is already in progress');
            return;
        }

        // Check workspace trust first
        if (!vscode.workspace.isTrusted) {
            const trustResponse = await vscode.window.showErrorMessage(
                'Pure Cinema requires a trusted workspace to record terminal sessions with real shell access.',
                'Learn More',
                'Cancel'
            );
            
            if (trustResponse === 'Learn More') {
                vscode.env.openExternal(vscode.Uri.parse('https://code.visualstudio.com/docs/editing/workspaces/workspace-trust'));
            }
            return;
        }

        // Security and privacy confirmation dialog
        const confirmed = await vscode.window.showWarningMessage(
            'Pure Cinema will:\n' +
            '• Create a real terminal that can execute system commands\n' +
            '• Record all input/output locally on your machine\n' +
            '• Never transmit any data externally\n\n' +
            'Only use in trusted workspaces with code you trust.',
            { modal: true },
            'Start Recording',
            'Cancel'
        );

        if (confirmed !== 'Start Recording') {
            return;
        }

        this.isRecording = true;
        const startTime = Date.now();
        
        // Use workspace folder if available, otherwise use user home directory
        const recordingCwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || 
                            process.env.USERPROFILE || 
                            process.env.HOME || 
                            process.cwd();
        
        this.currentRecording = {
            version: '1.0',
            startTime,
            frames: [],
            terminalInfo: {
                name: 'Pure Cinema Recording Terminal',
                cwd: recordingCwd,
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
        console.log('Pure Cinema: Starting terminal listener');
        // Create our own pseudoterminal to capture both input and output
        this.createRecordingTerminal();
        console.log('Pure Cinema: Terminal listener started');
    }

    private createRecordingTerminal(): void {
        const writeEmitter = new vscode.EventEmitter<string>();
        this.writeEmitter = writeEmitter;
        
        // Determine shell based on platform
        const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
        
        // Use workspace folder if available, otherwise use user home directory
        const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || 
                    process.env.USERPROFILE || 
                    process.env.HOME || 
                    process.cwd();
        
        const pty: vscode.Pseudoterminal = {
            onDidWrite: writeEmitter.event,
            open: () => {
                console.log('Pure Cinema: Pseudoterminal opened');
                writeEmitter.fire('Pure Cinema Terminal Starting...\r\n');
                this.startShellProcess(shell, cwd);
            },
            close: () => {
                console.log('Pure Cinema: Pseudoterminal closed');
                this.cleanupShellProcess();
            },
            handleInput: (data: string) => {
                console.log('Pure Cinema: Input received:', JSON.stringify(data), 'char codes:', data.split('').map(c => c.charCodeAt(0)));
                
                if (this.shellProcess && this.shellProcess.stdin) {
                    try {
                        const charCode = data.charCodeAt(0);
                        console.log('Pure Cinema: Processing char code:', charCode, 'character:', JSON.stringify(data));
                        
                        // Handle input by building a command buffer and recording keystrokes
                        if (charCode >= 32 && charCode <= 126) {
                            // Regular printable character - add to buffer
                            this.currentCommandBuffer += data;
                            writeEmitter.fire(data);
                            console.log('Pure Cinema: Added to buffer:', JSON.stringify(data), 'Buffer:', JSON.stringify(this.currentCommandBuffer));
                            
                            // Record individual keystroke for typing animation
                            if (this.currentRecording && this.isRecording) {
                                this.currentRecording.frames.push({
                                    timestamp: Date.now() - this.currentRecording.startTime,
                                    content: data,
                                    type: 'input'
                                });
                            }
                        } else if (charCode === 8 || charCode === 127) {
                            // Backspace - remove from buffer
                            if (this.currentCommandBuffer.length > 0) {
                                this.currentCommandBuffer = this.currentCommandBuffer.slice(0, -1);
                                writeEmitter.fire('\b \b');
                                console.log('Pure Cinema: Backspace - Buffer now:', JSON.stringify(this.currentCommandBuffer));
                                
                                // Record backspace for typing animation (will be processed during save)
                                if (this.currentRecording && this.isRecording) {
                                    this.currentRecording.frames.push({
                                        timestamp: Date.now() - this.currentRecording.startTime,
                                        content: '[BACKSPACE]',
                                        type: 'input'
                                    });
                                }
                            }
                        } else if (charCode === 13) {
                            // Enter key - send complete command to shell
                            writeEmitter.fire('\r\n');
                            console.log('Pure Cinema: Enter pressed - sending command:', JSON.stringify(this.currentCommandBuffer));
                            
                            // Send the clean command to shell
                            this.shellProcess.stdin.write(this.currentCommandBuffer + '\n');
                            
                            // Record Enter key for typing animation
                            if (this.currentRecording && this.isRecording) {
                                this.currentRecording.frames.push({
                                    timestamp: Date.now() - this.currentRecording.startTime,
                                    content: '\r\n',
                                    type: 'input'
                                });
                            }
                            
                            // Clear buffer for next command
                            this.currentCommandBuffer = '';
                        } else {
                            console.log('Pure Cinema: Unhandled character code:', charCode);
                        }
                        
                    } catch (error) {
                        console.error('Pure Cinema: Error processing input:', error);
                        if (this.writeEmitter) {
                            this.writeEmitter.fire(`\r\nInput Error: ${error}\r\n`);
                        }
                    }
                } else {
                    console.log('Pure Cinema: Shell process not ready, data:', JSON.stringify(data));
                    if (this.writeEmitter) {
                        this.writeEmitter.fire(`\r\n[Shell not ready - received: ${JSON.stringify(data)}]\r\n`);
                    }
                }
            }
        };

        console.log('Pure Cinema: Creating terminal with pseudoterminal');
        
        // Create a new terminal with our pseudoterminal
        const recordingTerminal = vscode.window.createTerminal({
            name: 'Pure Cinema Recording',
            pty: pty
        });
        
        console.log('Pure Cinema: Terminal created, showing...');
        recordingTerminal.show();
        this.activeTerminal = recordingTerminal;
        
        console.log('Pure Cinema: Terminal setup complete');
    }

    private startShellProcess(shell: string, cwd: string): void {
        try {
            console.log('Pure Cinema: Starting shell process:', shell, 'in', cwd);
            
            // Determine shell args for interactive mode
            const shellArgs: string[] = [];
            if (process.platform === 'win32') {
                // Windows cmd.exe - use /Q to disable command echo, /K to keep shell open
                shellArgs.push('/Q', '/K');
            } else {
                // Unix shells (bash, zsh, etc.)
                shellArgs.push('-i'); // Interactive mode
            }

            console.log('Pure Cinema: Shell args:', shellArgs);

            // Spawn the actual shell process
            this.shellProcess = spawn(shell, shellArgs, {
                cwd: cwd,
                env: { ...process.env, TERM: 'xterm-256color' },
                stdio: ['pipe', 'pipe', 'pipe']
            });

            console.log('Pure Cinema: Shell process spawned, PID:', this.shellProcess.pid);

            // Handle stdout (command output)
            this.shellProcess.stdout?.on('data', (data: Buffer) => {
                const content = data.toString();
                console.log('Pure Cinema: Shell stdout:', JSON.stringify(content));
                
                if (this.writeEmitter) {
                    // Always display in VS Code terminal
                    this.writeEmitter.fire(content);
                }
                
                if (this.currentRecording && this.isRecording) {
                    // Filter out various backspace and control characters from recorded content
                    // \x08 = backspace (BS), \x7F = delete (DEL), \x1B\[K = clear line, \x1B\[D = cursor left
                    console.log('Pure Cinema: Before filtering - Original content:', JSON.stringify(content));
                    console.log('Pure Cinema: Before filtering - Character codes:', content.split('').map(c => c.charCodeAt(0)));
                    
                    const cleanContent = content
                        .replace(/\x08+/g, '') // Backspace characters
                        .replace(/\x7F+/g, '') // Delete characters  
                        .replace(/\x1B\[K/g, '') // Clear line escape sequence
                        .replace(/\x1B\[D/g, '') // Cursor left escape sequence
                        .replace(/\x1B\[\d*D/g, '') // Cursor left N positions
                    
                    console.log('Pure Cinema: After filtering - Clean content:', JSON.stringify(cleanContent));
                    console.log('Pure Cinema: After filtering - Character codes:', cleanContent.split('').map(c => c.charCodeAt(0)));
                    
                    // Record output
                    this.currentRecording.frames.push({
                        timestamp: Date.now() - this.currentRecording.startTime,
                        content: cleanContent,
                        type: 'output'
                    });
                }
            });

            // Handle stderr (error output)
            this.shellProcess.stderr?.on('data', (data: Buffer) => {
                const content = data.toString();
                console.log('Pure Cinema: Shell stderr:', JSON.stringify(content));
                
                if (this.writeEmitter) {
                    // Always display in VS Code terminal  
                    this.writeEmitter.fire(content);
                }
                
                if (this.currentRecording && this.isRecording) {
                    // Filter out various backspace and control characters from recorded content
                    // \x08 = backspace (BS), \x7F = delete (DEL), \x1B\[K = clear line, \x1B\[D = cursor left
                    const cleanContent = content
                        .replace(/\x08+/g, '') // Backspace characters
                        .replace(/\x7F+/g, '') // Delete characters  
                        .replace(/\x1B\[K/g, '') // Clear line escape sequence
                        .replace(/\x1B\[D/g, '') // Cursor left escape sequence
                        .replace(/\x1B\[\d*D/g, '') // Cursor left N positions
                    console.log('Pure Cinema: stderr Original content:', JSON.stringify(content));
                    console.log('Pure Cinema: stderr Clean content:', JSON.stringify(cleanContent));
                    // Record as output (errors are still shell output)
                    this.currentRecording.frames.push({
                        timestamp: Date.now() - this.currentRecording.startTime,
                        content: cleanContent,
                        type: 'output'
                    });
                }
            });

            // Handle process exit
            this.shellProcess.on('exit', (code, signal) => {
                if (this.writeEmitter) {
                    const exitMessage = `\r\nProcess exited with code ${code}\r\n`;
                    this.writeEmitter.fire(exitMessage);
                    
                    if (this.currentRecording && this.isRecording) {
                        this.currentRecording.frames.push({
                            timestamp: Date.now() - this.currentRecording.startTime,
                            content: exitMessage,
                            type: 'output'
                        });
                    }
                }
            });

            // Handle process errors
            this.shellProcess.on('error', (error) => {
                if (this.writeEmitter) {
                    const errorMessage = `\r\nShell error: ${error.message}\r\n`;
                    this.writeEmitter.fire(errorMessage);
                    
                    if (this.currentRecording && this.isRecording) {
                        this.currentRecording.frames.push({
                            timestamp: Date.now() - this.currentRecording.startTime,
                            content: errorMessage,
                            type: 'output'
                        });
                    }
                }
                vscode.window.showErrorMessage(`Shell process error: ${error.message}`);
            });

            // Ensure stdin is ready for writing
            if (this.shellProcess.stdin) {
                this.shellProcess.stdin.setDefaultEncoding('utf8');
            }

            // Send initial command to show we're ready (optional)
            setTimeout(() => {
                if (this.shellProcess && this.shellProcess.stdin && process.platform !== 'win32') {
                    // On Unix, send a newline to get initial prompt
                    this.shellProcess.stdin.write('\n');
                }
            }, 100);

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to start shell: ${error}`);
        }
    }

    private cleanupShellProcess(): void {
        if (this.shellProcess) {
            try {
                this.shellProcess.kill();
            } catch (error) {
                console.error('Error killing shell process:', error);
            }
            this.shellProcess = null;
        }
        this.writeEmitter = null;
        this.currentCommandBuffer = '';
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

        // Clean up shell process
        this.cleanupShellProcess();

        // Save recording
        await this.saveRecording();
        
        // Clean up
        if (this.writeEmitterListener) {
            this.writeEmitterListener.dispose();
            this.writeEmitterListener = undefined;
        }

        vscode.window.showInformationMessage('Recording stopped and saved');
    }

    private processRecordingForPlayback(recording: Recording): Recording {
        const processedFrames: RecordingFrame[] = [];
        const inputBuffer: string[] = [];
        
        for (const frame of recording.frames) {
            if (frame.type === 'input') {
                if (frame.content === '[BACKSPACE]') {
                    // Apply backspace - remove the last character from buffer and processed frames
                    if (inputBuffer.length > 0) {
                        inputBuffer.pop();
                        // Remove the last input frame from processed frames
                        for (let i = processedFrames.length - 1; i >= 0; i--) {
                            if (processedFrames[i].type === 'input') {
                                processedFrames.splice(i, 1);
                                break;
                            }
                        }
                    }
                } else {
                    // Regular input character
                    inputBuffer.push(frame.content);
                    processedFrames.push(frame);
                }
            } else {
                // Keep all output frames as-is
                processedFrames.push(frame);
            }
        }
        
        return {
            ...recording,
            frames: processedFrames
        };
    }

    private async saveRecording(): Promise<void> {
        if (!this.currentRecording) {return;}

        // Process the recording to clean up typing animation artifacts
        const processedRecording = this.processRecordingForPlayback(this.currentRecording);

        const saveUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`recording-${new Date().toISOString().replace(/[:.]/g, '-')}.pcr`),
            filters: {
                'Pure Cinema Recordings': ['pcr']
            }
        });

        if (!saveUri) {return;}

        try {
            const recordingData = JSON.stringify(processedRecording, null, 2);
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
        this.cleanupShellProcess();
        this.disposables.forEach(d => d.dispose());
    }
}