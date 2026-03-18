import * as vscode from 'vscode';
import type { ClaudeModel } from './providers/types';

export interface ClawdCommitSettings {
    /** Claude model for commit message generation. */
    model: ClaudeModel;
    /** Whether to include full staged file content alongside the diff. */
    includeFileContext: boolean;
}

export function getSettings(): ClawdCommitSettings {
    const config = vscode.workspace.getConfiguration('clawdCommit');

    return {
        model: config.get<ClaudeModel>('model', 'sonnet'),
        includeFileContext: config.get<boolean>('includeFileContext', true),
    };
}
