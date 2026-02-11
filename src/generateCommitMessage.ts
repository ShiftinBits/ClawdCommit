import * as vscode from 'vscode';
import { getGitRepository, getStagedDiff, getRecentCommitLog } from './git';
import { runClaude } from './claude';
import { getSettings } from './settings';
import { buildInstruction, buildContext } from './prompts';

export async function generateCommitMessage(): Promise<void> {
    const repo = getGitRepository();
    if (!repo) {
        return;
    }

    const repoRoot = repo.rootUri.fsPath;
    const settings = getSettings();

    // Fetch staged diff and recent commit log concurrently
    const [diffResult, logResult] = await Promise.allSettled([
        getStagedDiff(repoRoot),
        getRecentCommitLog(repoRoot, 5),
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

    const log = logResult.status === 'fulfilled' ? logResult.value : '';

    // Run Claude with cancellable progress
    const message = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Generating commit message',
            cancellable: true,
        },
        async (_progress, token) => {
            const instruction = buildInstruction(settings.includeFileContext);
            const context = buildContext(diff, log);
            return runClaude(instruction, context, repoRoot, token, { model: settings.model });
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
    // Strip wrapping ```...``` if Claude adds them despite instructions
    const fencePattern = /^```(?:\w*)\n([\s\S]*?)\n```$/;
    const match = text.match(fencePattern);
    return match ? match[1].trim() : text;
}
