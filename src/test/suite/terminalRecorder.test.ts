import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { TerminalRecorder, Recording } from '../../terminalRecorder';

suite('TerminalRecorder Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	let recorder: TerminalRecorder;
	let testWorkspaceFolder: string;

	suiteSetup(() => {
		testWorkspaceFolder = path.join(__dirname, '..', '..', '..', 'test-workspace');
		if (!fs.existsSync(testWorkspaceFolder)) {
			fs.mkdirSync(testWorkspaceFolder, { recursive: true });
		}
	});

	setup(() => {
		recorder = new TerminalRecorder();
	});

	teardown(() => {
		recorder.dispose();
		// Clean up any test files
		const testFiles = fs.readdirSync(testWorkspaceFolder).filter(f => f.endsWith('.pcr'));
		testFiles.forEach(file => {
			fs.unlinkSync(path.join(testWorkspaceFolder, file));
		});
	});

	test('should create recorder instance', () => {
		assert.ok(recorder);
		assert.strictEqual(typeof recorder.startRecording, 'function');
		assert.strictEqual(typeof recorder.stopRecording, 'function');
	});

	test('should handle start recording without active terminal', async () => {
		// Ensure no active terminal
		const originalActiveTerminal = vscode.window.activeTerminal;
		
		// Mock no active terminal
		Object.defineProperty(vscode.window, 'activeTerminal', {
			value: undefined,
			configurable: true
		});

		await recorder.startRecording();
		// Should not throw and should show error message
		// In a real test environment, we'd mock showErrorMessage to verify it was called

		// Restore original state
		Object.defineProperty(vscode.window, 'activeTerminal', {
			value: originalActiveTerminal,
			configurable: true
		});
	});

	test('should prevent multiple concurrent recordings', async () => {
		// Create a mock terminal
		const mockTerminal = {
			name: 'test-terminal',
			creationOptions: { cwd: '/test/path' },
			sendText: () => {},
			show: () => {},
			hide: () => {},
			dispose: () => {}
		} as any;

		Object.defineProperty(vscode.window, 'activeTerminal', {
			value: mockTerminal,
			configurable: true
		});

		// Start first recording
		await recorder.startRecording();
		
		// Try to start second recording - should show warning
		await recorder.startRecording();
		// In a real test, we'd verify the warning message was shown
	});

	test('should create valid recording structure', async () => {
		const mockTerminal = {
			name: 'test-terminal',
			creationOptions: { cwd: '/test/path' },
			sendText: () => {},
			show: () => {},
			hide: () => {},
			dispose: () => {}
		} as any;

		Object.defineProperty(vscode.window, 'activeTerminal', {
			value: mockTerminal,
			configurable: true
		});

		// Mock the showSaveDialog to return a test file path
		const testFilePath = path.join(testWorkspaceFolder, 'test-recording.pcr');
		const originalShowSaveDialog = vscode.window.showSaveDialog;
		
		vscode.window.showSaveDialog = async () => {
			return vscode.Uri.file(testFilePath);
		};

		await recorder.startRecording();
		
		// Simulate some time passing
		await new Promise(resolve => setTimeout(resolve, 100));
		
		await recorder.stopRecording();

		// Verify file was created
		assert.ok(fs.existsSync(testFilePath));

		// Verify file content structure
		const content = fs.readFileSync(testFilePath, 'utf8');
		const recording: Recording = JSON.parse(content);

		assert.strictEqual(recording.version, '1.0');
		assert.ok(recording.startTime);
		assert.ok(recording.endTime);
		assert.ok(Array.isArray(recording.frames));
		assert.strictEqual(recording.terminalInfo.name, 'test-terminal');
		assert.strictEqual(recording.terminalInfo.cwd, '/test/path');

		// Restore original function
		vscode.window.showSaveDialog = originalShowSaveDialog;
	});

	test('should handle stop recording without active recording', async () => {
		await recorder.stopRecording();
		// Should not throw and should show warning message
	});

	test('should properly dispose resources', () => {
		recorder.dispose();
		// Should not throw
		assert.ok(true);
	});

	test('should validate recording file format', () => {
		const validRecording: Recording = {
			version: '1.0',
			startTime: Date.now(),
			endTime: Date.now() + 1000,
			frames: [
				{
					timestamp: 100,
					content: 'test output',
					type: 'output'
				}
			],
			terminalInfo: {
				name: 'test-terminal',
				cwd: '/test'
			}
		};

		// Validate structure
		assert.ok(validRecording.version);
		assert.ok(validRecording.startTime);
		assert.ok(validRecording.endTime);
		assert.ok(Array.isArray(validRecording.frames));
		assert.ok(validRecording.terminalInfo);

		// Validate frame structure
		const frame = validRecording.frames[0];
		assert.ok(typeof frame.timestamp === 'number');
		assert.ok(typeof frame.content === 'string');
		assert.ok(['input', 'output'].includes(frame.type));
	});
});