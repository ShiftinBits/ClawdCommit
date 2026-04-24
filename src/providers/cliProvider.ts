import { spawn, type ChildProcess } from 'child_process';
import * as vscode from 'vscode';
import { buildSystemPrompt } from '../prompts';
import type { CommitMessageProvider, ClaudeModel } from './types';

const TIMEOUT_MS = 120_000;

export class CliProvider implements CommitMessageProvider {
    constructor(private readonly cwd: string) {}

    generateMessage(
        instruction: string,
        context: string,
        cancellationToken: vscode.CancellationToken,
        options?: { model?: ClaudeModel }
    ): Promise<string | undefined> {
        const model: ClaudeModel = options?.model ?? 'sonnet';

        return new Promise<string | undefined>((resolve) => {
            if (cancellationToken.isCancellationRequested) {
                resolve(undefined);
                return;
            }

            const child: ChildProcess = spawn(
                'claude',
                [
                    '-p', instruction,
                    '--model', model,
                    '--system-prompt', buildSystemPrompt(),
                ],
                {
                    cwd: this.cwd,
                    stdio: ['pipe', 'pipe', 'pipe'],
                }
            );

            const stdoutChunks: Buffer[] = [];
            const stderrChunks: Buffer[] = [];
            let settled = false;

            const settle = (value: string | undefined) => {
                if (!settled) {
                    settled = true;
                    resolve(value);
                }
            };

            const timer = setTimeout(() => {
                child.kill('SIGTERM');
                vscode.window.showErrorMessage(
                    `Claude CLI timed out after ${TIMEOUT_MS / 1000} seconds.`
                );
                settle(undefined);
            }, TIMEOUT_MS);

            const cancelListener = cancellationToken.onCancellationRequested(() => {
                clearTimeout(timer);
                child.kill('SIGTERM');
                settle(undefined);
            });

            child.stdout?.on('data', (chunk: Buffer) => {
                stdoutChunks.push(chunk);
            });

            child.stderr?.on('data', (chunk: Buffer) => {
                stderrChunks.push(chunk);
            });

            child.on('close', (code) => {
                clearTimeout(timer);
                cancelListener.dispose();
                const stdout = Buffer.concat(stdoutChunks).toString();
                const stderr = Buffer.concat(stderrChunks).toString();

                if (cancellationToken.isCancellationRequested) {
                    settle(undefined);
                    return;
                }

                if (code !== 0) {
                    const msg = stderr.trim() || `Process exited with code ${code}`;
                    vscode.window.showErrorMessage(msg);
                    settle(undefined);
                    return;
                }

                settle(stdout);
            });

            child.on('error', (err: NodeJS.ErrnoException) => {
                clearTimeout(timer);
                cancelListener.dispose();

                if (err.code === 'ENOENT') {
                    vscode.window.showErrorMessage(
                        '"claude" CLI not found. Install Claude Code and ensure it is in your PATH.'
                    );
                } else {
                    vscode.window.showErrorMessage(
                        `Failed to start Claude CLI: ${err.message}`
                    );
                }
                settle(undefined);
            });

            child.stdin?.end(context);
        });
    }
}
