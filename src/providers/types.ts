import * as vscode from 'vscode';

export type ClaudeModel = 'haiku' | 'sonnet' | 'opus';

export interface CommitMessageProvider {
    generateMessage(
        instruction: string,
        context: string,
        token: vscode.CancellationToken,
        options?: { model?: ClaudeModel }
    ): Promise<string | undefined>;
}

export type ProviderFactory = (repoRoot: string) => CommitMessageProvider;
