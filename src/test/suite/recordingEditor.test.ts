import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { RecordingEditor } from '../../recordingEditor';
import { Recording } from '../../terminalRecorder';

suite('RecordingEditor Test Suite', () => {
	let editor: RecordingEditor;
	let testWorkspaceFolder: string;
	let testRecordingFile: string;
	let sampleRecording: Recording;

	suiteSetup(() => {
		testWorkspaceFolder = path.join(__dirname, '..', '..', '..', 'test-workspace');
		if (!fs.existsSync(testWorkspaceFolder)) {
			fs.mkdirSync(testWorkspaceFolder, { recursive: true });
		}

		testRecordingFile = path.join(testWorkspaceFolder, 'sample-edit-recording.pcr');
		
		// Create sample recording for testing
		sampleRecording = {
			version: '1.0',
			startTime: 1691750400000,
			endTime: 1691750410000, // 10 seconds
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
					timestamp: 2000,
					content: '$ ls -la',
					type: 'input'
				},
				{
					timestamp: 2100,
					content: 'total 8\ndrwxr-xr-x 2 user user 4096 Aug 11 10:00 .\n',
					type: 'output'
				},
				{
					timestamp: 5000,
					content: '$ pwd',
					type: 'input'
				},
				{
					timestamp: 5100,
					content: '/home/user\n',
					type: 'output'
				}
			],
			terminalInfo: {
				name: 'bash',
				cwd: '/home/user',
				shellPath: '/bin/bash'
			},
			dimensions: {
				width: 80,
				height: 24
			}
		};

		fs.writeFileSync(testRecordingFile, JSON.stringify(sampleRecording, null, 2));
	});

	suiteTeardown(() => {
		if (fs.existsSync(testRecordingFile)) {
			fs.unlinkSync(testRecordingFile);
		}
	});

	setup(() => {
		editor = new RecordingEditor();
	});

	teardown(() => {
		editor.dispose();
	});

	test('should create editor instance', () => {
		assert.ok(editor);
		assert.strictEqual(typeof editor.editRecording, 'function');
		assert.strictEqual(typeof editor.dispose, 'function');
	});

	test('should load recording file for editing', async () => {
		const uri = vscode.Uri.file(testRecordingFile);
		
		// Mock createWebviewPanel to capture the HTML content
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

			Object.defineProperty(mockPanel.webview, 'html', {
				set: (value: string) => {
					webviewContent = value;
				},
				get: () => webviewContent
			});

			return mockPanel;
		};

		await editor.editRecording(uri);

		// Verify editor webview was created
		assert.ok(webviewContent.includes('Pure Cinema Editor'));
		assert.ok(webviewContent.includes('📐 Dimensions'));
		assert.ok(webviewContent.includes('✂️ Timeline Trimming'));
		assert.ok(webviewContent.includes('width'));
		assert.ok(webviewContent.includes('height'));
		assert.ok(webviewContent.includes('startTime'));
		assert.ok(webviewContent.includes('endTime'));

		// Verify original recording info is displayed
		assert.ok(webviewContent.includes('10.0s')); // Duration
		assert.ok(webviewContent.includes('6')); // Frame count
		assert.ok(webviewContent.includes('bash')); // Terminal name

		// Restore original function
		vscode.window.createWebviewPanel = originalCreateWebviewPanel;
	});

	test('should handle invalid recording file', async () => {
		const invalidFile = path.join(testWorkspaceFolder, 'invalid-edit.pcr');
		fs.writeFileSync(invalidFile, 'invalid json content');

		const uri = vscode.Uri.file(invalidFile);
		
		let errorMessage = '';
		const originalShowErrorMessage = vscode.window.showErrorMessage;
		vscode.window.showErrorMessage = async (message: string) => {
			errorMessage = message;
			return undefined;
		};

		await editor.editRecording(uri);

		assert.ok(errorMessage.includes('Failed to load recording for editing'));

		// Clean up
		fs.unlinkSync(invalidFile);
		vscode.window.showErrorMessage = originalShowErrorMessage;
	});

	test('should apply dimension edits correctly', () => {
		// Access private method through type assertion for testing
		const editorAny = editor as any;
		
		const originalRecording = JSON.parse(JSON.stringify(sampleRecording));
		const edits = {
			dimensions: {
				width: 120,
				height: 40
			}
		};

		const editedRecording = editorAny.applyEdits(originalRecording, edits);

		assert.strictEqual(editedRecording.dimensions.width, 120);
		assert.strictEqual(editedRecording.dimensions.height, 40);
		assert.strictEqual(editedRecording.frames.length, originalRecording.frames.length);
	});

	test('should apply timeline trimming correctly', () => {
		const editorAny = editor as any;
		
		const originalRecording = JSON.parse(JSON.stringify(sampleRecording));
		const edits = {
			timeline: {
				startTime: 1500, // 1.5 seconds
				endTime: 4000    // 4 seconds
			}
		};

		const editedRecording = editorAny.applyEdits(originalRecording, edits);

		// Should only include frames between 1500ms and 4000ms
		assert.ok(editedRecording.frames.length < originalRecording.frames.length);
		
		// First frame should have timestamp adjusted to start from 0
		if (editedRecording.frames.length > 0) {
			const firstFrame = editedRecording.frames[0];
			assert.ok(firstFrame.timestamp >= 0);
		}

		// All frames should be within the trimmed range (adjusted)
		editedRecording.frames.forEach((frame: any) => {
			assert.ok(frame.timestamp <= (4000 - 1500));
		});
	});

	test('should handle combined dimension and timeline edits', () => {
		const editorAny = editor as any;
		
		const originalRecording = JSON.parse(JSON.stringify(sampleRecording));
		const edits = {
			dimensions: {
				width: 100,
				height: 30
			},
			timeline: {
				startTime: 1000,
				endTime: 6000
			}
		};

		const editedRecording = editorAny.applyEdits(originalRecording, edits);

		// Check dimensions
		assert.strictEqual(editedRecording.dimensions.width, 100);
		assert.strictEqual(editedRecording.dimensions.height, 30);

		// Check timeline trimming
		assert.ok(editedRecording.frames.length > 0);
		assert.ok(editedRecording.frames.length <= originalRecording.frames.length);
	});

	test('should handle edge cases in timeline trimming', () => {
		const editorAny = editor as any;
		
		const originalRecording = JSON.parse(JSON.stringify(sampleRecording));
		
		// Test trimming with start time after all frames
		const edits1 = {
			timeline: {
				startTime: 10000, // After all frames
				endTime: 15000
			}
		};

		const editedRecording1 = editorAny.applyEdits(originalRecording, edits1);
		assert.strictEqual(editedRecording1.frames.length, 0);

		// Test trimming with very small range
		const edits2 = {
			timeline: {
				startTime: 0,
				endTime: 50 // Very small range
			}
		};

		const editedRecording2 = editorAny.applyEdits(originalRecording, edits2);
		assert.ok(editedRecording2.frames.length >= 0);
	});

	test('should validate dimension inputs', () => {
		const editorAny = editor as any;
		
		const originalRecording = JSON.parse(JSON.stringify(sampleRecording));
		
		// Test with invalid dimensions (should use defaults)
		const edits = {
			dimensions: {
				width: 'invalid',
				height: 'invalid'
			}
		};

		const editedRecording = editorAny.applyEdits(originalRecording, edits);
		
		// Should fall back to default values
		assert.strictEqual(editedRecording.dimensions.width, 80); // Default
		assert.strictEqual(editedRecording.dimensions.height, 24); // Default
	});

	test('should preserve recording metadata during editing', () => {
		const editorAny = editor as any;
		
		const originalRecording = JSON.parse(JSON.stringify(sampleRecording));
		const edits = {
			dimensions: {
				width: 90,
				height: 30
			}
		};

		const editedRecording = editorAny.applyEdits(originalRecording, edits);

		// Metadata should be preserved
		assert.strictEqual(editedRecording.version, originalRecording.version);
		assert.strictEqual(editedRecording.terminalInfo.name, originalRecording.terminalInfo.name);
		assert.strictEqual(editedRecording.terminalInfo.cwd, originalRecording.terminalInfo.cwd);
		assert.strictEqual(editedRecording.terminalInfo.shellPath, originalRecording.terminalInfo.shellPath);
	});

	test('should properly dispose resources', () => {
		editor.dispose();
		assert.ok(true); // Should not throw
	});
});