import * as vscode from 'vscode';

export interface ClawdCommitSettings {
    /** Model for per-file analysis agents (map phase). */
    analysisModel: string;
    /** Model for commit message synthesis (reduce phase). */
    synthesisModel: string;
    /** Model for single-call generation (small commits). */
    singleCallModel: string;
    /** Minimum file count to trigger parallel map-reduce. */
    parallelFileThreshold: number;
    /** Maximum concurrent analysis agents. */
    maxConcurrentAgents: number;
    /** Whether to include full staged file content in analysis. */
    includeFileContext: boolean;
}

export function getSettings(): ClawdCommitSettings {
    const config = vscode.workspace.getConfiguration('clawdCommit');

    return {
        analysisModel: config.get<string>('analysisModel', 'haiku'),
        synthesisModel: config.get<string>('synthesisModel', 'sonnet'),
        singleCallModel: config.get<string>('singleCallModel', 'sonnet'),
        parallelFileThreshold: config.get<number>('parallelFileThreshold', 4),
        maxConcurrentAgents: config.get<number>('maxConcurrentAgents', 5),
        includeFileContext: config.get<boolean>('includeFileContext', true),
    };
}
