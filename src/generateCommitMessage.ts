import * as vscode from 'vscode';
import { getGitRepository, formatCommitLog } from './git';
import { getSettings } from './settings';
import { buildInstruction, buildContext } from './prompts';
import type { ProviderFactory } from './providers/types';

export async function generateCommitMessage(
    createProvider: ProviderFactory,
    canReadFiles: boolean = true,
    targetUri?: vscode.Uri
): Promise<void> {
    const repo = await getGitRepository(targetUri);
    if (!repo) {
        return;
    }

    const repoRoot = repo.rootUri.fsPath;
    const settings = getSettings();

    const [diffResult, logResult] = await Promise.allSettled([
        repo.diff(true),
        repo.log({ maxEntries: 5 }),
    ]);

    if (diffResult.status === 'rejected') {
        vscode.window.showErrorMessage(
            `Failed to get staged diff: ${diffResult.reason instanceof Error ? diffResult.reason.message : String(diffResult.reason)}`
        );
        return;
    }
    const diff = diffResult.value;

    if (!diff.trim()) {
        vscode.window.showWarningMessage(
            'No staged changes found. Stage some changes first.'
        );
        return;
    }

    const log = logResult.status === 'fulfilled'
        ? formatCommitLog(logResult.value)
        : '';

    const provider = createProvider(repoRoot);

    const message = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Generating commit message',
            cancellable: true,
        },
        async (_progress, token) => {
            const instruction = buildInstruction(settings.includeFileContext, canReadFiles);
            const context = buildContext(diff, log);
            return provider.generateMessage(instruction, context, token, { model: settings.model });
        }
    );

    if (message === undefined || message === null) {
        return;
    }

    const trimmed = stripCodeFences(message.trim());
    if (!trimmed) {
        vscode.window.showWarningMessage(
            'Claude returned an empty response.'
        );
        return;
    }

    repo.inputBox.value = trimmed;
}

function stripCodeFences(text: string): string {
    const fencePattern = /^```[^\n\r]*\r?\n([\s\S]*?)\r?\n```\s*$/;
    const match = text.match(fencePattern);
    return match ? match[1].trim() : text;
}
