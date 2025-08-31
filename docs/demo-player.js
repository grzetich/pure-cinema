class PureCinemaPlayer {
    constructor(containerId, recordingData) {
        this.container = document.getElementById(containerId);
        this.recording = recordingData;
        this.currentFrame = 0;
        this.isPlaying = false;
        this.playbackSpeed = 1.0;
        
        this.init();
    }
    
    init() {
        this.container.innerHTML = `
            <div class="demo-player">
                <div class="demo-terminal" id="${this.container.id}-terminal">
                    <div class="terminal-content"></div>
                </div>
                <div class="demo-controls">
                    <button class="play-btn" id="${this.container.id}-play">▶️ Play Demo</button>
                    <button class="reset-btn" id="${this.container.id}-reset">🔄 Reset</button>
                    <span class="demo-info">Pure Cinema Terminal Recording Demo</span>
                </div>
            </div>
        `;
        
        this.terminal = this.container.querySelector('.terminal-content');
        this.playBtn = document.getElementById(`${this.container.id}-play`);
        this.resetBtn = document.getElementById(`${this.container.id}-reset`);
        
        this.playBtn.addEventListener('click', () => this.togglePlayback());
        this.resetBtn.addEventListener('click', () => this.reset());
        
        this.reset();
    }
    
    reset() {
        this.currentFrame = 0;
        this.isPlaying = false;
        this.terminal.innerHTML = '';
        this.playBtn.textContent = '▶️ Play Demo';
    }
    
    togglePlayback() {
        if (this.isPlaying) {
            this.isPlaying = false;
            this.playBtn.textContent = '▶️ Play Demo';
        } else {
            this.isPlaying = true;
            this.playBtn.textContent = '⏸️ Pause';
            this.play();
        }
    }
    
    async play() {
        if (!this.isPlaying || this.currentFrame >= this.recording.frames.length) {
            this.isPlaying = false;
            this.playBtn.textContent = '▶️ Play Demo';
            return;
        }
        
        const frame = this.recording.frames[this.currentFrame];
        
        if (frame.type === 'input') {
            // Simulate typing
            for (let i = 0; i < frame.content.length; i++) {
                if (!this.isPlaying) return;
                this.terminal.innerHTML += `<span class="input-char">${this.escapeHtml(frame.content[i])}</span>`;
                this.terminal.scrollTop = this.terminal.scrollHeight;
                await this.sleep(50 / this.playbackSpeed);
            }
        } else {
            // Output appears instantly but with proper formatting
            const outputSpan = document.createElement('span');
            outputSpan.className = 'output-text';
            outputSpan.innerHTML = this.escapeHtml(frame.content).replace(/\r?\n/g, '<br>');
            this.terminal.appendChild(outputSpan);
        }
        
        this.terminal.scrollTop = this.terminal.scrollHeight;
        this.currentFrame++;
        
        // Wait for next frame
        const nextFrame = this.recording.frames[this.currentFrame];
        if (nextFrame) {
            const delay = Math.max(50, (nextFrame.timestamp - frame.timestamp) / this.playbackSpeed);
            await this.sleep(delay);
        }
        
        this.play();
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Demo recording data
const demoRecording = {
  "version": "1.0",
  "startTime": 1698765432000,
  "endTime": 1698765442000,
  "terminalInfo": {
    "name": "Demo Terminal",
    "cwd": "/home/user/projects",
    "shellPath": "/bin/bash",
    "dimensions": { "cols": 80, "rows": 24 }
  },
  "frames": [
    { "timestamp": 0, "content": "$ ", "type": "output" },
    { "timestamp": 500, "content": "echo \"Welcome to Pure Cinema!\"", "type": "input" },
    { "timestamp": 600, "content": "\r\n", "type": "output" },
    { "timestamp": 700, "content": "Welcome to Pure Cinema!", "type": "output" },
    { "timestamp": 800, "content": "\r\n", "type": "output" },
    { "timestamp": 1200, "content": "$ ", "type": "output" },
    { "timestamp": 2000, "content": "ls -la", "type": "input" },
    { "timestamp": 2100, "content": "\r\n", "type": "output" },
    { "timestamp": 2200, "content": "total 48", "type": "output" },
    { "timestamp": 2250, "content": "\r\n", "type": "output" },
    { "timestamp": 2300, "content": "drwxr-xr-x  5 user user 4096 Oct 31 10:30 .", "type": "output" },
    { "timestamp": 2350, "content": "\r\n", "type": "output" },
    { "timestamp": 2400, "content": "drwxr-xr-x  3 user user 4096 Oct 31 10:25 ..", "type": "output" },
    { "timestamp": 2450, "content": "\r\n", "type": "output" },
    { "timestamp": 2500, "content": "-rw-r--r--  1 user user  220 Oct 31 10:25 .bashrc", "type": "output" },
    { "timestamp": 2550, "content": "\r\n", "type": "output" },
    { "timestamp": 2600, "content": "drwxr-xr-x  8 user user 4096 Oct 31 10:30 .git", "type": "output" },
    { "timestamp": 2650, "content": "\r\n", "type": "output" },
    { "timestamp": 2700, "content": "-rw-r--r--  1 user user 1024 Oct 31 10:30 package.json", "type": "output" },
    { "timestamp": 2750, "content": "\r\n", "type": "output" },
    { "timestamp": 2800, "content": "-rw-r--r--  1 user user 2048 Oct 31 10:30 README.md", "type": "output" },
    { "timestamp": 2850, "content": "\r\n", "type": "output" },
    { "timestamp": 2900, "content": "drwxr-xr-x  2 user user 4096 Oct 31 10:30 src", "type": "output" },
    { "timestamp": 2950, "content": "\r\n", "type": "output" },
    { "timestamp": 3500, "content": "$ ", "type": "output" },
    { "timestamp": 4000, "content": "npm run build", "type": "input" },
    { "timestamp": 4100, "content": "\r\n", "type": "output" },
    { "timestamp": 4200, "content": "\r\n> demo-project@1.0.0 build", "type": "output" },
    { "timestamp": 4250, "content": "\r\n", "type": "output" },
    { "timestamp": 4300, "content": "> tsc && webpack", "type": "output" },
    { "timestamp": 4350, "content": "\r\n\r\n", "type": "output" },
    { "timestamp": 5000, "content": "✓ Compiled successfully in 1.2s", "type": "output" },
    { "timestamp": 5050, "content": "\r\n", "type": "output" },
    { "timestamp": 5500, "content": "$ ", "type": "output" },
    { "timestamp": 6000, "content": "echo \"Demo complete! 🎬\"", "type": "input" },
    { "timestamp": 6100, "content": "\r\n", "type": "output" },
    { "timestamp": 6200, "content": "Demo complete! 🎬", "type": "output" },
    { "timestamp": 6250, "content": "\r\n", "type": "output" },
    { "timestamp": 7000, "content": "$ ", "type": "output" }
  ]
};