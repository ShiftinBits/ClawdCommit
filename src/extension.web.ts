import * as vscode from 'vscode';
import { generateCommitMessage } from './generateCommitMessage';
import { LmApiProvider } from './providers/lmApiProvider';
import type { ProviderFactory } from './providers/types';
import { extractScmRootUri } from './scm';

export function activate(context: vscode.ExtensionContext): void {
    const createProvider: ProviderFactory = (_repoRoot) => new LmApiProvider();

    const disposable = vscode.commands.registerCommand(
        'clawdcommit.generateCommitMessage',
        (arg?: unknown) => generateCommitMessage(createProvider, false, extractScmRootUri(arg))
    );
    context.subscriptions.push(disposable);
}

export function deactivate(): void {}
