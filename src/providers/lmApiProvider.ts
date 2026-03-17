import * as vscode from 'vscode';
import type { CommitMessageProvider } from './types';

export class LmApiProvider implements CommitMessageProvider {
    async generateMessage(
        instruction: string,
        context: string,
        token: vscode.CancellationToken,
        options?: { model?: string }
    ): Promise<string | undefined> {
        const model = await this.selectModel(options?.model);
        if (!model) {
            vscode.window.showErrorMessage(
                'No Claude model found. Configure one via GitHub Copilot or VS Code Bring Your Own Key settings.'
            );
            return undefined;
        }

        const messages = [
            vscode.LanguageModelChatMessage.User(`${instruction}\n\n${context}`)
        ];

        try {
            const response = await model.sendRequest(messages, {}, token);

            const chunks: string[] = [];
            for await (const chunk of response.text) {
                if (token.isCancellationRequested) {
                    return undefined;
                }
                chunks.push(chunk);
            }
            return chunks.join('');
        } catch (err) {
            if (err instanceof vscode.LanguageModelError) {
                vscode.window.showErrorMessage(`Claude request failed: ${err.message}`);
            }
            return undefined;
        }
    }

    private async selectModel(preferredModel?: string): Promise<vscode.LanguageModelChat | undefined> {
        if (preferredModel) {
            const familyName = `claude-${preferredModel}`;
            const exact = await vscode.lm.selectChatModels({ vendor: 'anthropic', family: familyName });
            if (exact.length > 0) { return exact[0]; }
        }

        const anyAnthropic = await vscode.lm.selectChatModels({ vendor: 'anthropic' });
        if (anyAnthropic.length > 0) { return anyAnthropic[0]; }

        if (preferredModel) {
            const byFamily = await vscode.lm.selectChatModels({ family: `claude-${preferredModel}` });
            if (byFamily.length > 0) { return byFamily[0]; }
        }

        return undefined;
    }
}
