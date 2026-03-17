import * as vscode from 'vscode';
import { generateCommitMessage } from './generateCommitMessage';
import { LmApiProvider } from './providers/lmApiProvider';
import type { ProviderFactory } from './providers/types';

export function activate(context: vscode.ExtensionContext): void {
    const createProvider: ProviderFactory = () => new LmApiProvider();

    const disposable = vscode.commands.registerCommand(
        'clawdcommit.generateCommitMessage',
        () => generateCommitMessage(createProvider, false)
    );
    context.subscriptions.push(disposable);
}

export function deactivate(): void {}
