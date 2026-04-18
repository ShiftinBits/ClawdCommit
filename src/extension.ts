import * as vscode from 'vscode';
import { generateCommitMessage } from './generateCommitMessage';
import { CliProvider } from './providers/cliProvider';
import type { ProviderFactory } from './providers/types';
import { extractScmRootUri } from './scm';

export function activate(context: vscode.ExtensionContext): void {
    const createProvider: ProviderFactory = (repoRoot) => new CliProvider(repoRoot);

    const disposable = vscode.commands.registerCommand(
        'clawdcommit.generateCommitMessage',
        (arg?: unknown) => generateCommitMessage(createProvider, true, extractScmRootUri(arg))
    );
    context.subscriptions.push(disposable);
}

export function deactivate(): void {}
