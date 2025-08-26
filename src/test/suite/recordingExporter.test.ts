import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { RecordingExporter, ExportOptions } from '../../recordingExporter';
import { Recording } from '../../terminalRecorder';

suite('RecordingExporter Test Suite', () => {
	let exporter: RecordingExporter;
	let testWorkspaceFolder: string;
	let testRecordingFile: string;
	let sampleRecording: Recording;

	suiteSetup(() => {
		testWorkspaceFolder = path.join(__dirname, '..', '..', '..', 'test-workspace');
		if (!fs.existsSync(testWorkspaceFolder)) {
			fs.mkdirSync(testWorkspaceFolder, { recursive: true });
		}

		testRecordingFile = path.join(testWorkspaceFolder, 'sample-export-recording.pcr');
		
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
					content: '$ npm test',
					type: 'input'
				},
				{
					timestamp: 2100,
					content: '> test@1.0.0 test\n> jest\n\nPASS  src/test.js\n✓ should work (2 ms)\n\nTest Suites: 1 passed, 1 total\nTests:       1 passed, 1 total\n',
					type: 'output'
				}
			],
			terminalInfo: {
				name: 'bash',
				cwd: '/home/user/project',
				shellPath: '/bin/bash'
			},
			dimensions: {
				width: 100,
				height: 30
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
		exporter = new RecordingExporter();
	});

	teardown(() => {
		exporter.dispose();
	});

	test('should create exporter instance', () => {
		assert.ok(exporter);
		assert.strictEqual(typeof exporter.exportRecording, 'function');
		assert.strictEqual(typeof exporter.dispose, 'function');
	});

	test('should load recording for export', async () => {
		const uri = vscode.Uri.file(testRecordingFile);
		
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
				}
			});

			return mockPanel;
		};

		await exporter.exportRecording(uri);

		// Verify export interface was created
		assert.ok(webviewContent.includes('Export & Share Recording'));
		assert.ok(webviewContent.includes('Export Format'));
		assert.ok(webviewContent.includes('HTML (Interactive Web Page)'));
		assert.ok(webviewContent.includes('Quick Share to Social'));
		assert.ok(webviewContent.includes('Twitter'));
		assert.ok(webviewContent.includes('LinkedIn'));
		assert.ok(webviewContent.includes('GitHub'));

		// Restore
		vscode.window.createWebviewPanel = originalCreateWebviewPanel;
	});

	test('should generate HTML export correctly', () => {
		const exporterAny = exporter as any;
		const exportOptions: ExportOptions = {
			format: 'html',
			includeControls: true,
			theme: 'dark'
		};

		const htmlContent = exporterAny.generateHtmlExport(sampleRecording, exportOptions);

		// Verify HTML structure
		assert.ok(htmlContent.includes('<!DOCTYPE html>'));
		assert.ok(htmlContent.includes('<title>Pure Cinema Recording</title>'));
		assert.ok(htmlContent.includes('Terminal Recording'));
		
		// Verify metadata
		assert.ok(htmlContent.includes('10.0s')); // Duration
		assert.ok(htmlContent.includes('100 × 30')); // Dimensions
		assert.ok(htmlContent.includes('bash')); // Terminal
		assert.ok(htmlContent.includes('4')); // Frame count
		
		// Verify controls are included
		assert.ok(htmlContent.includes('id="playBtn"'));
		assert.ok(htmlContent.includes('id="pauseBtn"'));
		assert.ok(htmlContent.includes('id="progressBar"'));
		
		// Verify social sharing buttons
		assert.ok(htmlContent.includes('shareToTwitter'));
		assert.ok(htmlContent.includes('shareToLinkedIn'));
		assert.ok(htmlContent.includes('shareToGitHub'));
		
		// Verify recording data is embedded
		assert.ok(htmlContent.includes('const recording = '));
		assert.ok(htmlContent.includes(JSON.stringify(sampleRecording)));
		
		// Verify theme is applied
		assert.ok(htmlContent.includes('#1e1e1e')); // Dark background
	});

	test('should generate HTML export without controls', () => {
		const exporterAny = exporter as any;
		const exportOptions: ExportOptions = {
			format: 'html',
			includeControls: false,
			theme: 'light'
		};

		const htmlContent = exporterAny.generateHtmlExport(sampleRecording, exportOptions);

		// Controls should not be present
		assert.ok(!htmlContent.includes('.controls'));
		assert.ok(!htmlContent.includes('id="playBtn"'));
		
		// Should have static content function
		assert.ok(htmlContent.includes('showStaticContent()'));
		
		// Light theme should be applied
		assert.ok(htmlContent.includes('#ffffff')); // Light background
	});

	test('should generate JSON export with metadata', () => {
		const exporterAny = exporter as any;
		
		const jsonContent = exporterAny.generateJsonExport(sampleRecording);
		const exportedData = JSON.parse(jsonContent);

		// Verify original recording data is preserved
		assert.strictEqual(exportedData.version, sampleRecording.version);
		assert.strictEqual(exportedData.startTime, sampleRecording.startTime);
		assert.strictEqual(exportedData.endTime, sampleRecording.endTime);
		assert.deepStrictEqual(exportedData.frames, sampleRecording.frames);
		assert.deepStrictEqual(exportedData.terminalInfo, sampleRecording.terminalInfo);
		assert.deepStrictEqual(exportedData.dimensions, sampleRecording.dimensions);

		// Verify export metadata was added
		assert.ok(exportedData.exportInfo);
		assert.ok(exportedData.exportInfo.exportedAt);
		assert.strictEqual(exportedData.exportInfo.exportedBy, 'Pure Cinema VS Code Extension');
		assert.strictEqual(exportedData.exportInfo.version, sampleRecording.version);
	});

	test('should handle invalid recording file', async () => {
		const invalidFile = path.join(testWorkspaceFolder, 'invalid-export.pcr');
		fs.writeFileSync(invalidFile, 'invalid json content');

		const uri = vscode.Uri.file(invalidFile);
		
		let errorMessage = '';
		const originalShowErrorMessage = vscode.window.showErrorMessage;
		vscode.window.showErrorMessage = async (message: string) => {
			errorMessage = message;
			return undefined;
		};

		await exporter.exportRecording(uri);

		assert.ok(errorMessage.includes('Failed to load recording for export'));

		// Clean up
		fs.unlinkSync(invalidFile);
		vscode.window.showErrorMessage = originalShowErrorMessage;
	});

	test('should show warning for unimplemented formats', async () => {
		const exporterAny = exporter as any;
		const mockUri = vscode.Uri.file('/tmp/test.gif');
		
		let warningMessage = '';
		const originalShowWarningMessage = vscode.window.showWarningMessage;
		vscode.window.showWarningMessage = async (message: string, ...items: any[]) => {
			warningMessage = message;
			return undefined;
		};

		const exportOptions: ExportOptions = {
			format: 'gif',
			includeControls: true,
			theme: 'dark'
		};

		await exporterAny.generateGifExport(sampleRecording, '/tmp/test.gif', exportOptions);

		assert.ok(warningMessage.includes('GIF export is not yet implemented'));

		// Test MP4 warning
		warningMessage = '';
		await exporterAny.generateMp4Export(sampleRecording, '/tmp/test.mp4', exportOptions);
		assert.ok(warningMessage.includes('MP4 export is not yet implemented'));

		vscode.window.showWarningMessage = originalShowWarningMessage;
	});

	test('should generate proper social media integration', () => {
		const exporterAny = exporter as any;
		const exportOptions: ExportOptions = {
			format: 'html',
			includeControls: true,
			theme: 'dark'
		};

		const htmlContent = exporterAny.generateHtmlExport(sampleRecording, exportOptions);

		// Verify social media meta tags
		assert.ok(htmlContent.includes('property="og:title"'));
		assert.ok(htmlContent.includes('property="og:description"'));
		assert.ok(htmlContent.includes('name="twitter:card"'));
		assert.ok(htmlContent.includes('name="twitter:title"'));

		// Verify social sharing functions
		assert.ok(htmlContent.includes('function shareToTwitter()'));
		assert.ok(htmlContent.includes('function shareToLinkedIn()'));
		assert.ok(htmlContent.includes('function shareToGitHub()'));
		assert.ok(htmlContent.includes('function shareToDevTo()'));

		// Verify URLs are constructed correctly
		assert.ok(htmlContent.includes('https://twitter.com/intent/tweet'));
		assert.ok(htmlContent.includes('https://www.linkedin.com/sharing'));
		assert.ok(htmlContent.includes('https://dev.to/new'));
	});

	test('should handle different themes correctly', () => {
		const exporterAny = exporter as any;
		
		const darkOptions: ExportOptions = {
			format: 'html',
			includeControls: true,
			theme: 'dark'
		};

		const lightOptions: ExportOptions = {
			format: 'html',
			includeControls: true,
			theme: 'light'
		};

		const darkHtml = exporterAny.generateHtmlExport(sampleRecording, darkOptions);
		const lightHtml = exporterAny.generateHtmlExport(sampleRecording, lightOptions);

		// Dark theme
		assert.ok(darkHtml.includes('#1e1e1e')); // Dark background
		assert.ok(darkHtml.includes('#d4d4d4')); // Light text

		// Light theme
		assert.ok(lightHtml.includes('#ffffff')); // Light background
		assert.ok(lightHtml.includes('#000000')); // Dark text
	});

	test('should include proper attribution and links', () => {
		const exporterAny = exporter as any;
		const exportOptions: ExportOptions = {
			format: 'html',
			includeControls: true,
			theme: 'dark'
		};

		const htmlContent = exporterAny.generateHtmlExport(sampleRecording, exportOptions);

		// Verify attribution
		assert.ok(htmlContent.includes('Pure Cinema'));
		assert.ok(htmlContent.includes('VS Code'));
		
		// Note: In a real implementation, these would be actual links
		assert.ok(htmlContent.includes('Get the VS Code Extension'));
	});

	test('should properly dispose resources', () => {
		exporter.dispose();
		assert.ok(true); // Should not throw
	});
});