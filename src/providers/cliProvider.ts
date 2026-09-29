import { spawn, type ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { buildSystemPrompt } from '../prompts';
import type { CommitMessageProvider, ClaudeModel } from './types';

const TIMEOUT_MS = 120_000;
const STDERR_MAX_DISPLAY = 500;
const ALLOWED_MODELS: ReadonlySet<ClaudeModel> = new Set(['haiku', 'sonnet', 'opus']);

/**
 * On Windows, npm installs `claude` as a `claude.cmd` shim that spawn cannot
 * execute without cmd.exe, and cmd.exe truncates multi-line args and hides the
 * real process from kill(). Resolve the shim's cli.js and run it with node
 * directly instead. Falls back to plain `claude` (native installer's
 * claude.exe, or ENOENT when missing).
 */
function resolveClaudeCommand(args: string[]): [string, string[]] {
    if (process.platform !== 'win32') {
        return ['claude', args];
    }
    for (const dir of (process.env.PATH ?? '').split(path.win32.delimiter)) {
        if (fs.existsSync(path.win32.join(dir, 'claude.exe'))) {
            break;
        }
        const shim = path.win32.join(dir, 'claude.cmd');
        if (!fs.existsSync(shim)) {
            continue;
        }
        const match = /"%dp0%\\([^"]+\.js)"/.exec(fs.readFileSync(shim, 'utf8'));
        if (match) {
            return ['node', [path.win32.join(dir, match[1]), ...args]];
        }
    }
    return ['claude', args];
}

export class CliProvider implements CommitMessageProvider {
    constructor(private readonly cwd: string) {}

    generateMessage(
        instruction: string,
        context: string,
        cancellationToken: vscode.CancellationToken,
        options?: { model?: ClaudeModel }
    ): Promise<string | undefined> {
        const requested = options?.model ?? 'sonnet';
        const model: ClaudeModel = ALLOWED_MODELS.has(requested) ? requested : 'sonnet';

        return new Promise<string | undefined>((resolve) => {
            if (cancellationToken.isCancellationRequested) {
                resolve(undefined);
                return;
            }

            const [command, args] = resolveClaudeCommand([
                '-p', instruction,
                '--model', model,
                '--system-prompt', buildSystemPrompt(),
            ]);

            const child: ChildProcess = spawn(
                command,
                args,
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
                    cancelListener.dispose();
                    clearTimeout(timer);
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
                child.kill('SIGTERM');
                settle(undefined);
            });

            child.stdout?.on('data', (chunk: Buffer) => {
                stdoutChunks.push(chunk);
            });

            child.stderr?.on('data', (chunk: Buffer) => {
                stderrChunks.push(chunk);
            });

            // Swallow stdin stream errors (e.g. EPIPE if process exits before
            // we finish writing). The 'close' / 'error' handlers cover outcome.
            child.stdin?.on('error', () => {});

            child.on('close', (code) => {
                const stdout = Buffer.concat(stdoutChunks).toString();
                const stderr = Buffer.concat(stderrChunks).toString();

                if (cancellationToken.isCancellationRequested) {
                    settle(undefined);
                    return;
                }

                if (code !== 0) {
                    // claude -p reports some errors (e.g. auth) on stdout
                    const raw = stderr.trim() || stdout.trim() || `Process exited with code ${code}`;
                    const msg = raw.length > STDERR_MAX_DISPLAY
                        ? `${raw.slice(0, STDERR_MAX_DISPLAY)}…`
                        : raw;
                    vscode.window.showErrorMessage(`Claude CLI failed: ${msg}`);
                    settle(undefined);
                    return;
                }

                settle(stdout);
            });

            child.on('error', (err: NodeJS.ErrnoException) => {
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
