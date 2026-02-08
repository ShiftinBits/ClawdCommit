import * as vscode from 'vscode';
import { getGitRepository, getStagedDiff, getRecentCommitLog } from './git';
import { runClaude } from './claude';

export async function generateCommitMessage(): Promise<void> {
    const repo = getGitRepository();
    if (!repo) {
        return;
    }

    const repoRoot = repo.rootUri.fsPath;

    // Check for staged changes
    let diff: string;
    try {
        diff = await getStagedDiff(repoRoot);
    } catch (err) {
        vscode.window.showErrorMessage(
            `Claude Commit: Failed to get staged diff: ${err instanceof Error ? err.message : String(err)}`
        );
        return;
    }

    if (!diff.trim()) {
        vscode.window.showWarningMessage(
            'Claude Commit: No staged changes found. Stage some changes first.'
        );
        return;
    }

    // Gather recent commit log (non-fatal if it fails, e.g. new repo)
    let log = '';
    try {
        log = await getRecentCommitLog(repoRoot, 5);
    } catch {
        // Intentionally ignored — log is optional context
    }

    const instruction = buildInstruction();
    const context = buildContext(diff, log);

    // Run Claude with cancellable progress
    const message = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Claude Commit: Generating commit message...',
            cancellable: true,
        },
        async (_progress, token) => {
            return runClaude(instruction, context, repoRoot, token);
        }
    );

    if (message === undefined) {
        return;
    }

    const trimmed = stripCodeFences(message.trim());
    if (!trimmed) {
        vscode.window.showWarningMessage(
            'Claude Commit: Claude returned an empty response.'
        );
        return;
    }

    repo.inputBox.value = trimmed;
}

function buildInstruction(): string {
    return [
        'Generate a concise git commit message for the staged changes provided via stdin.',
        'Follow conventional commit style if the recent commit history uses it, otherwise match the existing style.',
        'Output ONLY the commit message text.',
        'No explanations, no markdown formatting, no code fences.',
        'Keep the subject line under 72 characters.',
        'If the changes warrant a body, add it after a blank line.',
    ].join(' ');
}

function buildContext(diff: string, log: string): string {
    let ctx = '=== STAGED DIFF ===\n' + diff;
    if (log.trim()) {
        ctx += '\n\n=== RECENT COMMITS ===\n' + log;
    }
    return ctx;
}

function stripCodeFences(text: string): string {
    // Strip wrapping ```...``` if Claude adds them despite instructions
    const fencePattern = /^```(?:\w*)\n([\s\S]*?)\n```$/;
    const match = text.match(fencePattern);
    return match ? match[1].trim() : text;
}
