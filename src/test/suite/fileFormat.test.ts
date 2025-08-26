import * as assert from 'assert';
import { Recording, RecordingFrame } from '../../terminalRecorder';

suite('File Format Test Suite', () => {
	test('should validate minimal recording structure', () => {
		const minimalRecording: Recording = {
			version: '1.0',
			startTime: Date.now(),
			frames: [],
			terminalInfo: {}
		};

		assert.strictEqual(minimalRecording.version, '1.0');
		assert.ok(minimalRecording.startTime);
		assert.ok(Array.isArray(minimalRecording.frames));
		assert.ok(typeof minimalRecording.terminalInfo === 'object');
	});

	test('should validate frame types', () => {
		const inputFrame: RecordingFrame = {
			timestamp: 1000,
			content: '$ echo test',
			type: 'input'
		};

		const outputFrame: RecordingFrame = {
			timestamp: 1100,
			content: 'test\n',
			type: 'output'
		};

		assert.strictEqual(inputFrame.type, 'input');
		assert.strictEqual(outputFrame.type, 'output');
		assert.ok(inputFrame.timestamp < outputFrame.timestamp);
	});

	test('should serialize and deserialize correctly', () => {
		const originalRecording: Recording = {
			version: '1.0',
			startTime: 1691750400000,
			endTime: 1691750405000,
			frames: [
				{
					timestamp: 0,
					content: '$ ls -la',
					type: 'input'
				},
				{
					timestamp: 100,
					content: 'total 4\n-rw-r--r-- 1 user user 123 Aug 11 10:00 file.txt\n',
					type: 'output'
				}
			],
			terminalInfo: {
				name: 'bash',
				cwd: '/home/user',
				shellPath: '/bin/bash'
			}
		};

		const serialized = JSON.stringify(originalRecording);
		const deserialized: Recording = JSON.parse(serialized);

		assert.deepStrictEqual(deserialized, originalRecording);
		assert.strictEqual(deserialized.frames.length, 2);
		assert.strictEqual(deserialized.frames[0].type, 'input');
		assert.strictEqual(deserialized.frames[1].type, 'output');
	});

	test('should handle unicode characters in content', () => {
		const unicodeFrame: RecordingFrame = {
			timestamp: 0,
			content: '🎬 Recording started 🎭 多言語テスト العربية',
			type: 'output'
		};

		const serialized = JSON.stringify(unicodeFrame);
		const deserialized: RecordingFrame = JSON.parse(serialized);

		assert.strictEqual(deserialized.content, unicodeFrame.content);
	});

	test('should handle ANSI escape codes', () => {
		const ansiFrame: RecordingFrame = {
			timestamp: 0,
			content: '\x1b[31mError:\x1b[0m Something went wrong\n\x1b[32mSuccess:\x1b[0m All good',
			type: 'output'
		};

		const serialized = JSON.stringify(ansiFrame);
		const deserialized: RecordingFrame = JSON.parse(serialized);

		assert.strictEqual(deserialized.content, ansiFrame.content);
		assert.ok(deserialized.content.includes('\x1b[31m')); // Red color
		assert.ok(deserialized.content.includes('\x1b[32m')); // Green color
		assert.ok(deserialized.content.includes('\x1b[0m'));  // Reset
	});

	test('should maintain timestamp ordering', () => {
		const frames: RecordingFrame[] = [
			{ timestamp: 0, content: 'first', type: 'output' },
			{ timestamp: 500, content: 'second', type: 'input' },
			{ timestamp: 1000, content: 'third', type: 'output' },
			{ timestamp: 1500, content: 'fourth', type: 'output' }
		];

		for (let i = 1; i < frames.length; i++) {
			assert.ok(frames[i].timestamp >= frames[i - 1].timestamp, 
				`Frame ${i} timestamp should be >= previous frame`);
		}
	});

	test('should validate version compatibility', () => {
		const recordings = [
			{ version: '1.0', isValid: true },
			{ version: '1.1', isValid: true },  // Future minor versions should be compatible
			{ version: '2.0', isValid: false }, // Major version changes may break compatibility
			{ version: '0.9', isValid: false }, // Older versions may not have all features
		];

		recordings.forEach(({ version, isValid }) => {
			const versionParts = version.split('.').map(Number);
			const majorVersion = versionParts[0];
			
			if (isValid) {
				assert.ok(majorVersion === 1, `Version ${version} should be valid`);
			} else {
				assert.ok(majorVersion !== 1, `Version ${version} should be invalid`);
			}
		});
	});

	test('should calculate file size efficiency', () => {
		const longRecording: Recording = {
			version: '1.0',
			startTime: Date.now(),
			endTime: Date.now() + 10000,
			frames: Array.from({ length: 100 }, (_, i) => ({
				timestamp: i * 100,
				content: `Output line ${i}\n`,
				type: 'output' as const
			})),
			terminalInfo: {
				name: 'test-terminal',
				cwd: '/test'
			}
		};

		const serialized = JSON.stringify(longRecording);
		const fileSize = new TextEncoder().encode(serialized).length;
		
		// With 100 frames, file should be reasonably compact (less than 10KB for this test)
		assert.ok(fileSize < 10000, `File size ${fileSize} bytes should be reasonable for 100 frames`);
		
		// Verify compression potential by checking repetition
		const compressed = serialized.replace(/"type":"output"/g, '"t":"o"');
		const compressionRatio = compressed.length / serialized.length;
		assert.ok(compressionRatio < 1, 'File format should have compression potential');
	});
});