import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { RecordingPlayer } from '../../recordingPlayer';
import { Recording } from '../../terminalRecorder';

suite('RecordingPlayer Test Suite', () => {
	let player: RecordingPlayer;
	let testWorkspaceFolder: string;
	let testRecordingFile: string;
	let sampleRecording: Recording;

	suiteSetup(() => {
		testWorkspaceFolder = path.join(__dirname, '..', '..', '..', 'test-workspace');
		if (!fs.existsSync(testWorkspaceFolder)) {
			fs.mkdirSync(testWorkspaceFolder, { recursive: true });
		}

		testRecordingFile = path.join(testWorkspaceFolder, 'sample-recording.pcr');
		
		// Create sample recording for testing
		sampleRecording = {
			version: '1.0',
			startTime: 1691750400000, // Fixed timestamp for testing
			endTime: 1691750405000,   // 5 seconds later
			frames: [
				{
					timestamp: 0,
					content: '$ echo "Hello World"',
					type: 'input'
				},
				{
					timestamp: 100,
					content: 'Hello World\n',
					type: 'output'
				},
				{
					timestamp: 1000,
					content: '$ ls -la',
					type: 'input'
				},
				{
					timestamp: 1100,
					content: 'total 8\ndrwxr-xr-x 2 user user 4096 Aug 11 10:00 .\ndrwxr-xr-x 3 user user 4096 Aug 11 09:59 ..\n',
					type: 'output'
				}
			],
			terminalInfo: {
				name: 'test-terminal',
				cwd: '/home/user/test',
				shellPath: '/bin/bash'
			}
		};

		fs.writeFileSync(testRecordingFile, JSON.stringify(sampleRecording, null, 2));
	});

	suiteTeardown(() => {
		// Clean up test files
		if (fs.existsSync(testRecordingFile)) {
			fs.unlinkSync(testRecordingFile);
		}
	});

	setup(() => {
		player = new RecordingPlayer();
	});

	teardown(() => {
		player.dispose();
	});

	test('should create player instance', () => {
		assert.ok(player);
		assert.strictEqual(typeof player.playRecording, 'function');
		assert.strictEqual(typeof player.dispose, 'function');
	});

	test('should load and parse recording file', async () => {
		const uri = vscode.Uri.file(testRecordingFile);
		
		// Mock createWebviewPanel to capture the content
		let webviewContent: string = '';
		const originalCreateWebviewPanel = vscode.window.createWebviewPanel;
		
		vscode.window.createWebviewPanel = (viewType: string, title: string, showOptions: any, options?: any) => {
			const mockPanel = {
				webview: {
					html: '',
					onDidReceiveMessage: () => ({ dispose: () => {} }),
					postMessage: () => Promise.resolve(true)
				},
				dispose: () => {}
			} as any;

			// Capture the HTML content when it's set
			Object.defineProperty(mockPanel.webview, 'html', {
				set: (value: string) => {
					webviewContent = value;
				},
				get: () => webviewContent
			});

			return mockPanel;
		};

		await player.playRecording(uri);

		// Verify webview was created with recording data
		assert.ok(webviewContent.includes('Recording Information'));
		assert.ok(webviewContent.includes('test-terminal'));
		assert.ok(webviewContent.includes('5.0s')); // Duration
		assert.ok(webviewContent.includes('4')); // Number of frames

		// Restore original function
		vscode.window.createWebviewPanel = originalCreateWebviewPanel;
	});

	test('should handle invalid recording file', async () => {
		const invalidFile = path.join(testWorkspaceFolder, 'invalid.pcr');
		fs.writeFileSync(invalidFile, 'invalid json content');

		const uri = vscode.Uri.file(invalidFile);
		
		// Mock showErrorMessage to capture error
		let errorMessage = '';
		const originalShowErrorMessage = vscode.window.showErrorMessage;
		vscode.window.showErrorMessage = async (message: string) => {
			errorMessage = message;
			return undefined;
		};

		await player.playRecording(uri);

		assert.ok(errorMessage.includes('Failed to load recording'));

		// Clean up
		fs.unlinkSync(invalidFile);
		vscode.window.showErrorMessage = originalShowErrorMessage;
	});

	test('should handle non-existent file', async () => {
		const nonExistentFile = path.join(testWorkspaceFolder, 'does-not-exist.pcr');
		const uri = vscode.Uri.file(nonExistentFile);

		let errorMessage = '';
		const originalShowErrorMessage = vscode.window.showErrorMessage;
		vscode.window.showErrorMessage = async (message: string) => {
			errorMessage = message;
			return undefined;
		};

		await player.playRecording(uri);

		assert.ok(errorMessage.includes('Failed to load recording'));

		vscode.window.showErrorMessage = originalShowErrorMessage;
	});

	test('should generate correct webview HTML structure', async () => {
		const uri = vscode.Uri.file(testRecordingFile);
		let capturedHtml = '';

		const originalCreateWebviewPanel = vscode.window.createWebviewPanel;
		vscode.window.createWebviewPanel = (viewType: string, title: string, showOptions: any, options?: any) => {
			const mockPanel = {
				webview: {
					html: '',
					onDidReceiveMessage: () => ({ dispose: () => {} }),
					postMessage: () => Promise.resolve(true)
				},
				dispose: () => {}
			} as any;

			Object.defineProperty(mockPanel.webview, 'html', {
				set: (value: string) => {
					capturedHtml = value;
				}
			});

			return mockPanel;
		};

		await player.playRecording(uri);

		// Verify essential HTML elements are present
		assert.ok(capturedHtml.includes('<title>Pure Cinema Player</title>'));
		assert.ok(capturedHtml.includes('id="playBtn"'));
		assert.ok(capturedHtml.includes('id="pauseBtn"'));
		assert.ok(capturedHtml.includes('id="resetBtn"'));
		assert.ok(capturedHtml.includes('id="terminalOutput"'));
		assert.ok(capturedHtml.includes('id="copyBtn"'));
		assert.ok(capturedHtml.includes('id="progressBar"'));

		// Verify recording data is embedded
		assert.ok(capturedHtml.includes(JSON.stringify(sampleRecording)));

		// Verify CSS styles are included
		assert.ok(capturedHtml.includes('.terminal-output'));
		assert.ok(capturedHtml.includes('.controls'));

		// Verify JavaScript functionality
		assert.ok(capturedHtml.includes('playRecording()'));
		assert.ok(capturedHtml.includes('vscode.postMessage'));

		vscode.window.createWebviewPanel = originalCreateWebviewPanel;
	});

	test('should handle webview message for copy functionality', async () => {
		const uri = vscode.Uri.file(testRecordingFile);
		let messageHandler: ((message: any) => void) | undefined;

		const originalCreateWebviewPanel = vscode.window.createWebviewPanel;
		vscode.window.createWebviewPanel = (viewType: string, title: string, showOptions: any, options?: any) => {
			return {
				webview: {
					html: '',
					onDidReceiveMessage: (handler: (message: any) => void) => {
						messageHandler = handler;
						return { dispose: () => {} };
					},
					postMessage: () => Promise.resolve(true)
				},
				dispose: () => {}
			} as any;
		};

		// Mock clipboard
		let clipboardContent = '';
		const originalWriteText = vscode.env.clipboard.writeText;
		vscode.env.clipboard.writeText = async (text: string) => {
			clipboardContent = text;
		};

		// Mock info message
		let infoMessage = '';
		const originalShowInformationMessage = vscode.window.showInformationMessage;
		vscode.window.showInformationMessage = async (message: string) => {
			infoMessage = message;
			return undefined;
		};

		await player.playRecording(uri);

		// Simulate copy message from webview
		if (messageHandler) {
			messageHandler({
				command: 'copy',
				text: 'test terminal output'
			});
		}

		assert.strictEqual(clipboardContent, 'test terminal output');
		assert.strictEqual(infoMessage, 'Text copied to clipboard');

		// Restore original functions
		vscode.window.createWebviewPanel = originalCreateWebviewPanel;
		vscode.env.clipboard.writeText = originalWriteText;
		vscode.window.showInformationMessage = originalShowInformationMessage;
	});

	test('should properly dispose resources', () => {
		player.dispose();
		assert.ok(true); // Should not throw
	});

	test('should calculate recording duration correctly', async () => {
		const uri = vscode.Uri.file(testRecordingFile);
		let webviewHtml = '';

		const originalCreateWebviewPanel = vscode.window.createWebviewPanel;
		vscode.window.createWebviewPanel = (viewType: string, title: string, showOptions: any, options?: any) => {
			const mockPanel = {
				webview: {
					html: '',
					onDidReceiveMessage: () => ({ dispose: () => {} }),
					postMessage: () => Promise.resolve(true)
				},
				dispose: () => {}
			} as any;

			Object.defineProperty(mockPanel.webview, 'html', {
				set: (value: string) => {
					webviewHtml = value;
				}
			});

			return mockPanel;
		};

		await player.playRecording(uri);

		// Recording duration should be 5 seconds (endTime - startTime = 5000ms)
		assert.ok(webviewHtml.includes('5.0s'));

		vscode.window.createWebviewPanel = originalCreateWebviewPanel;
	});
});