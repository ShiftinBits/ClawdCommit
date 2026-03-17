import * as vscode from 'vscode';

export interface CommitMessageProvider {
    generateMessage(
        instruction: string,
        context: string,
        token: vscode.CancellationToken,
        options?: { model?: string }
    ): Promise<string | undefined>;
}

export type ProviderFactory = (repoRoot: string) => CommitMessageProvider;
