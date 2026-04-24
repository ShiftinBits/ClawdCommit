/// <reference lib="webworker" />
import * as vscode from 'vscode';
import type { CommitMessageProvider, ClaudeModel } from './types';

export class LmApiProvider implements CommitMessageProvider {
    async generateMessage(
        instruction: string,
        context: string,
        token: vscode.CancellationToken,
        options?: { model?: ClaudeModel }
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
                const suffix = err.code ? ` [${err.code}]` : '';
                vscode.window.showErrorMessage(`Claude request failed${suffix}: ${err.message}`);
            } else {
                const message = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(`Unexpected error: ${message}`);
            }
            return undefined;
        }
    }

    private toFamilyName(model: ClaudeModel): string {
        return `claude-${model}`;
    }

    private async selectModel(preferredModel?: ClaudeModel): Promise<vscode.LanguageModelChat | undefined> {
        if (preferredModel) {
            const exact = await vscode.lm.selectChatModels({ vendor: 'anthropic', family: this.toFamilyName(preferredModel) });
            if (exact.length > 0) { return exact[0]; }
        }

        const anyAnthropic = await vscode.lm.selectChatModels({ vendor: 'anthropic' });
        if (anyAnthropic.length > 0) {
            if (preferredModel && !anyAnthropic[0].family.startsWith(this.toFamilyName(preferredModel))) {
                vscode.window.showWarningMessage(
                    `Configured Claude model "${preferredModel}" is not available. Using "${anyAnthropic[0].family}" instead.`
                );
            }
            return anyAnthropic[0];
        }

        if (preferredModel) {
            const byFamily = await vscode.lm.selectChatModels({ family: this.toFamilyName(preferredModel) });
            if (byFamily.length > 0) { return byFamily[0]; }
        }

        return undefined;
    }
}
