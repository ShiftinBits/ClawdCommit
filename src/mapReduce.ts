import * as vscode from 'vscode';
import type { FileDiff } from './diffParser';
import type { ClawdCommitSettings } from './settings';
import { runClaude } from './claude';
import { getStagedFileContent } from './git';
import { mapWithConcurrency } from './concurrency';
import {
    buildAnalysisInstruction,
    buildAnalysisContext,
    buildSynthesisInstruction,
    buildSynthesisContext,
} from './prompts';

interface AnalysisResult {
    filePath: string;
    analysis: string;
}

/**
 * Run the map-reduce commit message generation pipeline.
 *
 * Map phase: Spawns bounded-parallel analysis agents, one per non-binary file.
 * Reduce phase: Spawns a single synthesis agent combining all analyses.
 *
 * @returns string on success, undefined if cancelled, null if failed (fallback signal).
 */
export async function mapReduceGenerate(
    fileDiffs: FileDiff[],
    log: string,
    cwd: string,
    settings: ClawdCommitSettings,
    progress: vscode.Progress<{ increment?: number; message?: string }>,
    token: vscode.CancellationToken
): Promise<string | null | undefined> {
    const analyzable = fileDiffs.filter((f) => !f.isBinary);
    const binaryFiles = fileDiffs.filter((f) => f.isBinary).map((f) => f.filePath);

    if (analyzable.length === 0) {
        // Nothing to analyze (all binary) — signal fallback
        return null;
    }

    // Fetch staged file content for each analyzable file (parallel, bounded)
    let fileContents: Map<string, string | null> = new Map();
    if (settings.includeFileContext) {
        const contents = await mapWithConcurrency(
            analyzable,
            settings.maxConcurrentAgents,
            async (fileDiff) => {
                if (fileDiff.status === 'deleted') {
                    return { path: fileDiff.filePath, content: null };
                }
                const content = await getStagedFileContent(fileDiff.filePath, cwd);
                return { path: fileDiff.filePath, content };
            },
            token
        );
        for (const result of contents) {
            if (result) {
                fileContents.set(result.path, result.content);
            }
        }
    }

    if (token.isCancellationRequested) {
        return undefined;
    }

    // Map phase: run analysis agents in parallel
    const analysisInstruction = buildAnalysisInstruction();
    let completed = 0;

    const analysisResults = await mapWithConcurrency(
        analyzable,
        settings.maxConcurrentAgents,
        async (fileDiff): Promise<AnalysisResult | null> => {
            const fileContent = fileContents.get(fileDiff.filePath) ?? null;
            const context = buildAnalysisContext(
                fileDiff.filePath,
                fileDiff.rawDiff,
                fileContent
            );

            const result = await runClaude(
                analysisInstruction,
                context,
                cwd,
                token,
                { model: settings.analysisModel, silent: true }
            );

            completed++;
            progress.report({
                increment: 70 / analyzable.length,
                message: `Analyzing file ${completed} of ${analyzable.length}: ${basename(fileDiff.filePath)}...`,
            });

            if (result === undefined && !token.isCancellationRequested) {
                // Agent failed but not cancelled — use placeholder
                return {
                    filePath: fileDiff.filePath,
                    analysis: `[Analysis unavailable] Changes in ${fileDiff.filePath}`,
                };
            }

            if (result === undefined) {
                return null; // Cancelled
            }

            return { filePath: fileDiff.filePath, analysis: result.trim() };
        },
        token
    );

    if (token.isCancellationRequested) {
        return undefined;
    }

    // Collect successful analyses
    const analyses: AnalysisResult[] = analysisResults.filter(
        (r): r is AnalysisResult => r !== null
    );

    if (analyses.length === 0) {
        // All agents failed — signal fallback
        return null;
    }

    // Reduce phase: synthesize commit message
    progress.report({ increment: 0, message: 'Synthesizing commit message...' });

    const synthesisInstruction = buildSynthesisInstruction();
    const synthesisContext = buildSynthesisContext(analyses, binaryFiles, log);

    const result = await runClaude(
        synthesisInstruction,
        synthesisContext,
        cwd,
        token,
        { model: settings.synthesisModel }
    );

    progress.report({ increment: 30 });

    if (result === undefined) {
        return token.isCancellationRequested ? undefined : null;
    }

    return result;
}

function basename(filePath: string): string {
    const parts = filePath.split('/');
    return parts[parts.length - 1] ?? filePath;
}
