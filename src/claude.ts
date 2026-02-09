import { spawn, type ChildProcess } from 'child_process';
import * as vscode from 'vscode';

export interface RunClaudeOptions {
    /** Claude model to use (default: 'sonnet'). */
    model?: string;
    /** Suppress error toasts for parallel agents (default: false). ENOENT always shows. */
    silent?: boolean;
}

/**
 * Run `claude -p "instruction"` with context piped via stdin.
 *
 * Returns the generated commit message, or undefined if cancelled/errored.
 */
export function runClaude(
    instruction: string,
    context: string,
    cwd: string,
    cancellationToken: vscode.CancellationToken,
    options?: RunClaudeOptions
): Promise<string | undefined> {
    const model = options?.model ?? 'sonnet';
    const silent = options?.silent ?? false;

    return new Promise<string | undefined>((resolve) => {
        if (cancellationToken.isCancellationRequested) {
            resolve(undefined);
            return;
        }

        const child: ChildProcess = spawn('claude', ['-p', instruction, '--model', model], {
            cwd,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env },
        });

        let stdout = '';
        let stderr = '';
        let settled = false;

        const settle = (value: string | undefined) => {
            if (!settled) {
                settled = true;
                resolve(value);
            }
        };

        const cancelListener = cancellationToken.onCancellationRequested(() => {
            child.kill('SIGTERM');
            settle(undefined);
        });

        child.stdout?.on('data', (chunk: Buffer) => {
            stdout += chunk.toString();
        });

        child.stderr?.on('data', (chunk: Buffer) => {
            stderr += chunk.toString();
        });

        child.on('close', (code) => {
            cancelListener.dispose();

            if (cancellationToken.isCancellationRequested) {
                settle(undefined);
                return;
            }

            if (code !== 0) {
                if (!silent) {
                    const msg = stderr.trim() || `Process exited with code ${code}`;
                    vscode.window.showErrorMessage(`ClawdCommit: ${msg}`);
                }
                settle(undefined);
                return;
            }

            settle(stdout);
        });

        child.on('error', (err: NodeJS.ErrnoException) => {
            cancelListener.dispose();

            if (err.code === 'ENOENT') {
                // Always show ENOENT — this is a setup problem, not a transient error
                vscode.window.showErrorMessage(
                    'ClawdCommit: "claude" CLI not found. Install Claude Code and ensure it is in your PATH.'
                );
            } else if (!silent) {
                vscode.window.showErrorMessage(
                    `ClawdCommit: Failed to start Claude CLI: ${err.message}`
                );
            }
            settle(undefined);
        });

        child.stdin?.write(context);
        child.stdin?.end();
    });
}
