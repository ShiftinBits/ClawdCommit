import * as vscode from 'vscode';
import { getGitRepository, getStagedDiff, getStagedFileContent, getRecentCommitLog } from './git';
import { runClaude } from './claude';
import { parseUnifiedDiff, type FileDiff } from './diffParser';
import { getSettings, type ClawdCommitSettings } from './settings';
import { buildSingleCallInstruction, buildSingleCallContext } from './prompts';
import { mapReduceGenerate } from './mapReduce';

export async function generateCommitMessage(): Promise<void> {
    const repo = getGitRepository();
    if (!repo) {
        return;
    }

    const repoRoot = repo.rootUri.fsPath;
    const settings = getSettings();

    // Check for staged changes
    let diff: string;
    try {
        diff = await getStagedDiff(repoRoot);
    } catch (err) {
        vscode.window.showErrorMessage(
            `Failed to get staged diff: ${err instanceof Error ? err.message : String(err)}`
        );
        return;
    }

    if (!diff.trim()) {
        vscode.window.showWarningMessage(
            'No staged changes found. Stage some changes first.'
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

    // Parse diff into per-file segments
    let fileDiffs: FileDiff[];
    try {
        fileDiffs = parseUnifiedDiff(diff);
    } catch {
        // If parsing fails, fall back to single-call with raw diff
        fileDiffs = [];
    }

    const useMapReduce =
        fileDiffs.length >= settings.parallelFileThreshold;

    // Run Claude with cancellable progress
    const message = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: useMapReduce
                ? 'Analyzing changes'
                : 'Generating commit message',
            cancellable: true,
        },
        async (progress, token) => {
            if (useMapReduce) {
                const result = await mapReduceGenerate(
                    fileDiffs, log, repoRoot, settings, progress, token
                );
                // null means map-reduce failed — fall back to single-call
                if (result === null && !token.isCancellationRequested) {
                    progress.report({ message: 'Falling back to single generation' });
                    return singleCallGenerate(diff, log, fileDiffs, repoRoot, settings, token);
                }
                return result;
            }
            return singleCallGenerate(diff, log, fileDiffs, repoRoot, settings, token);
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

async function singleCallGenerate(
    diff: string,
    log: string,
    fileDiffs: FileDiff[],
    cwd: string,
    settings: ClawdCommitSettings,
    token: vscode.CancellationToken
): Promise<string | undefined> {
    let fileContexts: Array<{ filePath: string; content: string }> | null = null;

    if (settings.includeFileContext && fileDiffs.length > 0) {
        const retrievable = fileDiffs.filter(
            (f) => !f.isBinary && f.status !== 'deleted'
        );
        const results = await Promise.all(
            retrievable.map(async (f) => {
                const content = await getStagedFileContent(f.filePath, cwd);
                return content ? { filePath: f.filePath, content } : null;
            })
        );
        fileContexts = results.filter(
            (r): r is { filePath: string; content: string } => r !== null
        );
    }

    const instruction = buildSingleCallInstruction();
    const context = buildSingleCallContext(diff, log, fileContexts);
    return runClaude(instruction, context, cwd, token, { model: settings.singleCallModel });
}

function stripCodeFences(text: string): string {
    // Strip wrapping ```...``` if Claude adds them despite instructions
    const fencePattern = /^```(?:\w*)\n([\s\S]*?)\n```$/;
    const match = text.match(fencePattern);
    return match ? match[1].trim() : text;
}
