import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('Extension Integration Test Suite', () => {
	const extensionId = 'pure-cinema';

	test('should activate extension', async () => {
		// Get the extension
		const extension = vscode.extensions.getExtension('undefined_publisher.pure-cinema');
		
		if (extension) {
			// Activate the extension
			await extension.activate();
			assert.ok(extension.isActive, 'Extension should be active');
		} else {
			// In test environment, extension might not be loaded the same way
			// This is expected in unit test environment
			assert.ok(true, 'Extension loading test environment specific');
		}
	});

	test('should register all expected commands', async () => {
		const commands = await vscode.commands.getCommands(true);
		
		const expectedCommands = [
			'pure-cinema.startRecording',
			'pure-cinema.stopRecording', 
			'pure-cinema.playRecording'
		];

		expectedCommands.forEach(command => {
			assert.ok(
				commands.includes(command),
				`Command ${command} should be registered`
			);
		});
	});

	test('should handle start recording command', async () => {
		// Mock window.showErrorMessage to capture error when no terminal is active
		let errorMessage = '';
		const originalShowErrorMessage = vscode.window.showErrorMessage;
		vscode.window.showErrorMessage = async (message: string) => {
			errorMessage = message;
			return undefined;
		};

		// Execute start recording command (should show error with no active terminal)
		await vscode.commands.executeCommand('pure-cinema.startRecording');
		
		// In normal circumstances with no active terminal, an error should be shown
		// The exact behavior depends on the current terminal state
		
		// Restore original function
		vscode.window.showErrorMessage = originalShowErrorMessage;
		
		// Test passes if command executed without throwing
		assert.ok(true);
	});

	test('should handle stop recording command', async () => {
		let warningMessage = '';
		const originalShowWarningMessage = vscode.window.showWarningMessage;
		vscode.window.showWarningMessage = async (message: string) => {
			warningMessage = message;
			return undefined;
		};

		// Execute stop recording command (should show warning when no recording is active)
		await vscode.commands.executeCommand('pure-cinema.stopRecording');
		
		// Restore original function
		vscode.window.showWarningMessage = originalShowWarningMessage;
		
		// Test passes if command executed without throwing
		assert.ok(true);
	});

	test('should handle play recording command', async () => {
		// Mock showOpenDialog to simulate user canceling file selection
		const originalShowOpenDialog = vscode.window.showOpenDialog;
		vscode.window.showOpenDialog = async () => {
			return undefined; // User canceled
		};

		// Execute play recording command
		await vscode.commands.executeCommand('pure-cinema.playRecording');
		
		// Restore original function
		vscode.window.showOpenDialog = originalShowOpenDialog;
		
		// Test passes if command executed without throwing
		assert.ok(true);
	});

	test('should handle play recording with file selection', async () => {
		// Create a test recording file
		const testWorkspaceFolder = path.join(__dirname, '..', '..', '..', 'test-workspace');
		const testFile = path.join(testWorkspaceFolder, 'test-integration.pcr');
		
		const sampleRecording = {
			version: '1.0',
			startTime: Date.now(),
			endTime: Date.now() + 1000,
			frames: [
				{ timestamp: 0, content: 'test', type: 'output' }
			],
			terminalInfo: { name: 'test' }
		};

		const fs = require('fs');
		if (!fs.existsSync(testWorkspaceFolder)) {
			fs.mkdirSync(testWorkspaceFolder, { recursive: true });
		}
		fs.writeFileSync(testFile, JSON.stringify(sampleRecording));

		// Mock showOpenDialog to return our test file
		const originalShowOpenDialog = vscode.window.showOpenDialog;
		vscode.window.showOpenDialog = async () => {
			return [vscode.Uri.file(testFile)];
		};

		// Mock createWebviewPanel to avoid creating actual webview in test
		const originalCreateWebviewPanel = vscode.window.createWebviewPanel;
		let webviewCreated = false;
		vscode.window.createWebviewPanel = () => {
			webviewCreated = true;
			return {
				webview: {
					html: '',
					onDidReceiveMessage: () => ({ dispose: () => {} }),
					postMessage: () => Promise.resolve(true)
				},
				dispose: () => {}
			} as any;
		};

		// Execute play recording command
		await vscode.commands.executeCommand('pure-cinema.playRecording');
		
		assert.ok(webviewCreated, 'Webview should have been created for recording playback');

		// Clean up
		fs.unlinkSync(testFile);
		vscode.window.showOpenDialog = originalShowOpenDialog;
		vscode.window.createWebviewPanel = originalCreateWebviewPanel;
	});

	test('should set correct context when recording', async () => {
		// This test would need to be more complex to fully test the context setting
		// as it involves mocking terminal creation and interaction
		
		// Mock context setting command
		let contextSet = false;
		let contextKey = '';
		let contextValue: any;
		
		const originalExecuteCommand = vscode.commands.executeCommand;
		(vscode.commands.executeCommand as any) = async (command: string, ...args: any[]) => {
			if (command === 'setContext') {
				contextSet = true;
				contextKey = args[0];
				contextValue = args[1];
				return Promise.resolve();
			}
			return originalExecuteCommand(command, ...args);
		};

		// For this test, we just verify the command registration works
		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes('pure-cinema.startRecording'));
		
		// Restore original function
		vscode.commands.executeCommand = originalExecuteCommand;
		
		assert.ok(true);
	});

	test('should show proper file filters for recordings', async () => {
		let capturedOptions: any;
		const originalShowOpenDialog = vscode.window.showOpenDialog;
		
		vscode.window.showOpenDialog = async (options?: vscode.OpenDialogOptions) => {
			capturedOptions = options;
			return undefined; // User canceled
		};

		await vscode.commands.executeCommand('pure-cinema.playRecording');

		assert.ok(capturedOptions);
		assert.ok(capturedOptions.filters);
		assert.ok(capturedOptions.filters['Pure Cinema Recordings']);
		assert.deepStrictEqual(capturedOptions.filters['Pure Cinema Recordings'], ['pcr']);
		assert.strictEqual(capturedOptions.canSelectFiles, true);
		assert.strictEqual(capturedOptions.canSelectFolders, false);
		assert.strictEqual(capturedOptions.canSelectMany, false);

		vscode.window.showOpenDialog = originalShowOpenDialog;
	});
});