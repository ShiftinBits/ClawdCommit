import * as vscode from 'vscode';
import { getGitRepository, formatCommitLog } from './git';
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

    // Use VSCode's git extension API for both the staged diff and commit log
    // rather than shelling out to the CLI.  The API routes through the same
    // managed git process that handles staging, so it always reflects the
    // current index state shown in the Source Control pane.
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
