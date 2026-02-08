import * as vscode from 'vscode';
import { generateCommitMessage } from './generateCommitMessage';

export function activate(context: vscode.ExtensionContext): void {
    const disposable = vscode.commands.registerCommand(
        'clawdcommit.generateCommitMessage',
        () => generateCommitMessage()
    );
    context.subscriptions.push(disposable);
}

export function deactivate(): void {
    // No cleanup needed — child processes are managed per-invocation
}
