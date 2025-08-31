#!/usr/bin/env node

/**
 * Cross-platform compatibility test for Pure Cinema
 * Tests shell detection, file operations, and basic functionality
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('🎬 Pure Cinema - Cross-Platform Test\n');

// Test 1: Platform Detection
console.log('📋 Platform Information:');
console.log(`  OS: ${os.type()} ${os.release()}`);
console.log(`  Platform: ${process.platform}`);
console.log(`  Architecture: ${os.arch()}`);
console.log(`  Node.js: ${process.version}\n`);

// Test 2: Shell Detection Logic (from terminalRecorder.ts)
console.log('🐚 Shell Detection:');
const detectedShell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
console.log(`  Detected shell: ${detectedShell}`);

// Test 3: Available Shells
console.log('  Available shells:');
const commonShells = [
  '/bin/bash',
  '/bin/zsh', 
  '/bin/sh',
  '/usr/bin/fish',
  '/bin/dash',
  'C:\\Windows\\System32\\cmd.exe',
  'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
];

for (const shell of commonShells) {
  if (fs.existsSync(shell)) {
    console.log(`    ✅ ${shell}`);
  }
}

// Test 4: Shell Arguments Logic
console.log('\n⚙️  Shell Arguments:');
const shellArgs = [];
if (process.platform === 'win32') {
  shellArgs.push('/K');
} else {
  shellArgs.push('-i');
}
console.log(`  Args for ${detectedShell}: ${shellArgs.join(' ')}\n`);

// Test 5: File System Operations
console.log('📁 File System Test:');
try {
  const testDir = path.join(os.tmpdir(), 'pure-cinema-test');
  const testFile = path.join(testDir, 'test.pcr');
  
  // Create test directory
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  // Write test recording file
  const testRecording = {
    version: '1.0',
    startTime: Date.now(),
    frames: [
      { timestamp: 0, content: 'echo "test"', type: 'input' },
      { timestamp: 100, content: 'test\n', type: 'output' }
    ],
    terminalInfo: {
      name: 'Test Terminal',
      cwd: process.cwd(),
      shellPath: detectedShell
    }
  };
  
  fs.writeFileSync(testFile, JSON.stringify(testRecording, null, 2));
  console.log(`  ✅ Created: ${testFile}`);
  
  // Read and parse
  const readBack = JSON.parse(fs.readFileSync(testFile, 'utf8'));
  console.log(`  ✅ Read back: ${readBack.frames.length} frames`);
  
  // Cleanup
  fs.unlinkSync(testFile);
  fs.rmdirSync(testDir);
  console.log('  ✅ Cleanup successful');
  
} catch (error) {
  console.log(`  ❌ File system error: ${error.message}`);
}

// Test 6: Basic Shell Spawn Test
console.log('\n🔄 Shell Spawn Test:');
const testShell = spawn(detectedShell, shellArgs, {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, TERM: 'xterm-256color' }
});

let output = '';
let hasOutput = false;

testShell.stdout.on('data', (data) => {
  output += data.toString();
  hasOutput = true;
});

testShell.stderr.on('data', (data) => {
  console.log(`  ⚠️  Shell stderr: ${data.toString().trim()}`);
});

// Send a simple command
setTimeout(() => {
  if (process.platform === 'win32') {
    testShell.stdin.write('echo Hello Pure Cinema\r\n');
  } else {
    testShell.stdin.write('echo "Hello Pure Cinema"\n');
  }
}, 100);

// Check results after 2 seconds
setTimeout(() => {
  testShell.kill();
  
  if (hasOutput) {
    console.log('  ✅ Shell communication successful');
    console.log(`  📤 Output preview: ${output.slice(0, 100).replace(/\r?\n/g, '\\n')}`);
  } else {
    console.log('  ❌ No shell output received');
  }
  
  console.log('\n🏁 Test Complete');
  
  // Summary
  const platform = process.platform;
  const compatible = process.platform === 'win32' ? 
    fs.existsSync('C:\\Windows\\System32\\cmd.exe') : 
    fs.existsSync(detectedShell);
  
  console.log(`\n📊 Compatibility Summary:`);
  console.log(`  Platform: ${platform}`);
  console.log(`  Shell Available: ${compatible ? '✅' : '❌'}`);
  console.log(`  Estimated Compatibility: ${compatible ? '🟢 Good' : '🔴 Issues Expected'}`);
  
}, 2000);

testShell.on('error', (error) => {
  console.log(`  ❌ Shell spawn error: ${error.message}`);
});