import * as vscode from 'vscode';
import { Recording, RecordingFrame } from './terminalRecorder';

/**
 * AI-Aware Recording System
 * 
 * Detects and captures interactions with various AI tools:
 * - VS Code AI extensions (Claude Code, Cursor AI, etc.)
 * - CLI AI tools (gh copilot, aider, gemini, etc.)
 * - AI-generated content vs user input
 */

export interface AIInteractionFrame {
    timestamp: number;
    content: string;
    type: 'input' | 'output' | 'ai_suggestion' | 'ai_thinking' | 'ai_response';
    source?: 'user' | 'ai' | 'claude_code' | 'github_copilot' | 'cursor' | 'aider' | 'gemini';
    metadata?: {
        confidence?: number; // How sure we are this is AI-generated
        processingTime?: number; // Time AI took to respond
        toolName?: string; // Specific AI tool identified
        conversationId?: string; // Link related interactions
    };
}

export interface AIAwareRecording extends Omit<Recording, 'frames'> {
    frames: AIInteractionFrame[];
    aiToolsDetected: string[]; // List of AI tools identified during session
    totalAIInteractions: number;
    aiProcessingTime: number; // Total time spent on AI responses
}

export class AIAwareRecorder {
    private isRecording: boolean = false;
    private currentRecording: AIAwareRecording | null = null;
    private aiDetectionPatterns: Map<string, RegExp> = new Map();
    private commandQueue: AIInteractionFrame[] = [];
    private lastCommandTime: number = 0;

    constructor() {
        this.initializeAIDetectionPatterns();
        this.setupVSCodeIntegration();
    }

    private initializeAIDetectionPatterns(): void {
        // Common AI CLI tool patterns
        this.aiDetectionPatterns.set('github_copilot', /^gh\s+copilot/);
        this.aiDetectionPatterns.set('aider', /^aider/);
        this.aiDetectionPatterns.set('gemini', /^gemini/);
        this.aiDetectionPatterns.set('cursor_cli', /^cursor/);
        this.aiDetectionPatterns.set('openai_cli', /^openai/);
        this.aiDetectionPatterns.set('claude_cli', /^claude/);
        
        // AI-like response patterns
        this.aiDetectionPatterns.set('ai_response_thinking', /^(?:thinking|processing|analyzing)/i);
        this.aiDetectionPatterns.set('ai_response_confident', /^(?:I'll|Let me|I can|I would suggest|Based on)/i);
        this.aiDetectionPatterns.set('ai_code_block', /^```[\w]*\n/);
        this.aiDetectionPatterns.set('ai_explanation', /^(?:This code|The solution|Here's how)/i);
    }

    private setupVSCodeIntegration(): void {
        // Monitor VS Code commands for AI extensions
        const commandDisposable = vscode.commands.registerCommand('*', (...args) => {
            this.detectVSCodeAIActivity(args);
        });

        // Monitor terminal data for AI CLI tools
        vscode.window.onDidOpenTerminal(terminal => {
            this.monitorTerminalForAI(terminal);
        });

        // Monitor editor changes that might be AI-generated
        vscode.workspace.onDidChangeTextDocument(event => {
            this.analyzeTextChangesForAI(event);
        });
    }

    private detectVSCodeAIActivity(commandArgs: any[]): void {
        if (!this.isRecording) return;

        // Look for common AI extension command patterns
        const command = commandArgs[0];
        if (typeof command === 'string') {
            const aiTools = [
                'claude-code',
                'cursor',
                'github.copilot',
                'continue.continue',
                'tabnine',
                'codewhisperer'
            ];

            const detectedTool = aiTools.find(tool => command.includes(tool));
            if (detectedTool) {
                this.recordAIInteraction({
                    timestamp: Date.now() - (this.currentRecording?.startTime || Date.now()),
                    content: `[AI Tool Activity: ${detectedTool}]`,
                    type: 'ai_thinking',
                    source: detectedTool as any,
                    metadata: {
                        toolName: detectedTool,
                        confidence: 0.9
                    }
                });
            }
        }
    }

    private monitorTerminalForAI(terminal: vscode.Terminal): void {
        // This is tricky - VS Code doesn't provide direct access to terminal output
        // We'll need to use the pseudoterminal approach and enhance pattern detection
        
        // For now, we'll enhance the existing terminal recorder with AI detection
        console.log(`Monitoring terminal ${terminal.name} for AI activity`);
    }

    private analyzeTextChangesForAI(event: vscode.TextDocumentChangeEvent): void {
        if (!this.isRecording) return;

        // Analyze text changes for AI-like patterns
        for (const change of event.contentChanges) {
            const text = change.text;
            
            // Check if this looks like AI-generated code/text
            const confidence = this.calculateAIConfidence(text);
            if (confidence > 0.7) {
                this.recordAIInteraction({
                    timestamp: Date.now() - (this.currentRecording?.startTime || Date.now()),
                    content: text.length > 100 ? text.substring(0, 100) + '...' : text,
                    type: 'ai_suggestion',
                    source: 'ai',
                    metadata: {
                        confidence,
                        toolName: 'unknown_ai'
                    }
                });
            }
        }
    }

    private calculateAIConfidence(text: string): number {
        let confidence = 0;
        
        // Heuristics for AI-generated content
        if (text.includes('```')) confidence += 0.3; // Code blocks
        if (text.match(/^\/\*\*[\s\S]*\*\/$/)) confidence += 0.2; // JSDoc comments
        if (text.match(/^\s*\/\/\s*.+/gm)) confidence += 0.1; // Multiple comments
        if (text.length > 200 && text.includes('\n')) confidence += 0.2; // Long structured text
        if (text.match(/(?:function|class|interface|type)\s+\w+/)) confidence += 0.2; // Code structures
        
        // AI-like language patterns
        const aiPhrases = [
            'Here\'s how',
            'Let me help',
            'I\'ll create',
            'This will',
            'Based on your request',
            'I\'ve implemented',
            'The solution involves'
        ];
        
        for (const phrase of aiPhrases) {
            if (text.includes(phrase)) confidence += 0.3;
        }
        
        return Math.min(confidence, 1.0);
    }

    public startAIAwareRecording(): AIAwareRecording {
        this.isRecording = true;
        this.currentRecording = {
            version: '1.0',
            startTime: Date.now(),
            frames: [],
            terminalInfo: {
                name: 'AI-Aware Pure Cinema Recording',
                cwd: process.cwd(),
                shellPath: 'ai-aware-session'
            },
            aiToolsDetected: [],
            totalAIInteractions: 0,
            aiProcessingTime: 0
        };

        // Record session start
        this.recordAIInteraction({
            timestamp: 0,
            content: '[AI-Aware Recording Started]',
            type: 'output',
            source: 'user',
            metadata: {
                toolName: 'pure-cinema',
                confidence: 1.0
            }
        });

        return this.currentRecording;
    }

    public stopAIAwareRecording(): AIAwareRecording | null {
        if (!this.currentRecording) return null;

        this.isRecording = false;
        this.currentRecording.endTime = Date.now();

        // Add session summary
        this.recordAIInteraction({
            timestamp: this.currentRecording.endTime - this.currentRecording.startTime,
            content: `[AI-Aware Recording Ended - Detected: ${this.currentRecording.aiToolsDetected.join(', ')}]`,
            type: 'output',
            source: 'user',
            metadata: {
                toolName: 'pure-cinema',
                confidence: 1.0
            }
        });

        const recording = this.currentRecording;
        this.currentRecording = null;
        return recording;
    }

    private recordAIInteraction(frame: AIInteractionFrame): void {
        if (!this.currentRecording || !this.isRecording) return;

        this.currentRecording.frames.push(frame);
        this.currentRecording.totalAIInteractions++;

        // Track AI tools
        if (frame.metadata?.toolName && 
            !this.currentRecording.aiToolsDetected.includes(frame.metadata.toolName)) {
            this.currentRecording.aiToolsDetected.push(frame.metadata.toolName);
        }

        // Track processing time
        if (frame.metadata?.processingTime) {
            this.currentRecording.aiProcessingTime += frame.metadata.processingTime;
        }
    }

    public detectAICommand(command: string): { isAI: boolean; tool?: string; confidence: number } {
        for (const [toolName, pattern] of this.aiDetectionPatterns.entries()) {
            if (pattern.test(command)) {
                return {
                    isAI: true,
                    tool: toolName,
                    confidence: 0.95
                };
            }
        }

        // Secondary heuristics
        const aiKeywords = ['ai', 'gpt', 'claude', 'gemini', 'copilot', 'assistant'];
        const hasAIKeyword = aiKeywords.some(keyword => command.toLowerCase().includes(keyword));
        
        if (hasAIKeyword) {
            return {
                isAI: true,
                confidence: 0.7
            };
        }

        return { isAI: false, confidence: 0 };
    }

    public enhanceRegularRecording(originalFrame: RecordingFrame): AIInteractionFrame {
        // Enhance regular terminal recordings with AI detection
        const enhanced: AIInteractionFrame = {
            ...originalFrame,
            source: 'user'
        };

        if (originalFrame.type === 'input') {
            const detection = this.detectAICommand(originalFrame.content);
            if (detection.isAI) {
                enhanced.type = 'ai_suggestion';
                enhanced.source = 'ai';
                enhanced.metadata = {
                    confidence: detection.confidence,
                    toolName: detection.tool || 'unknown_ai'
                };
            }
        }

        return enhanced;
    }
}