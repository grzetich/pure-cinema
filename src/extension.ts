import * as vscode from 'vscode';
import { TerminalRecorder } from './terminalRecorder';
import { RecordingPlayer } from './recordingPlayer';
import { RecordingEditor } from './recordingEditor';
import { RecordingExporter } from './recordingExporter';

let recorder: TerminalRecorder | undefined;
let player: RecordingPlayer | undefined;
let editor: RecordingEditor | undefined;
let exporter: RecordingExporter | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('Pure Cinema extension is now active!');

    recorder = new TerminalRecorder();
    player = new RecordingPlayer();
    editor = new RecordingEditor();
    exporter = new RecordingExporter();

    const startRecordingCommand = vscode.commands.registerCommand('pure-cinema.startRecording', () => {
        recorder?.startRecording();
    });

    const stopRecordingCommand = vscode.commands.registerCommand('pure-cinema.stopRecording', () => {
        recorder?.stopRecording();
    });

    const playRecordingCommand = vscode.commands.registerCommand('pure-cinema.playRecording', async () => {
        const uri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'Pure Cinema Recordings': ['pcr']
            }
        });

        if (uri && uri[0]) {
            player?.playRecording(uri[0]);
        }
    });

    const editRecordingCommand = vscode.commands.registerCommand('pure-cinema.editRecording', async () => {
        const uri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'Pure Cinema Recordings': ['pcr']
            }
        });

        if (uri && uri[0]) {
            editor?.editRecording(uri[0]);
        }
    });

    const exportRecordingCommand = vscode.commands.registerCommand('pure-cinema.exportRecording', async () => {
        const uri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'Pure Cinema Recordings': ['pcr']
            }
        });

        if (uri && uri[0]) {
            exporter?.exportRecording(uri[0]);
        }
    });

    context.subscriptions.push(startRecordingCommand, stopRecordingCommand, playRecordingCommand, editRecordingCommand, exportRecordingCommand);
}

export function deactivate() {
    recorder?.dispose();
    player?.dispose();
    editor?.dispose();
    exporter?.dispose();
}