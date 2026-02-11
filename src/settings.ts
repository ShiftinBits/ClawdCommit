import * as vscode from 'vscode';

export interface ClawdCommitSettings {
    /** Claude model for commit message generation. */
    model: string;
    /** Whether to include full staged file content alongside the diff. */
    includeFileContext: boolean;
}

export function getSettings(): ClawdCommitSettings {
    const config = vscode.workspace.getConfiguration('clawdCommit');

    return {
        model: config.get<string>('model', 'sonnet'),
        includeFileContext: config.get<boolean>('includeFileContext', true),
    };
}
