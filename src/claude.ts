import { spawn, type ChildProcess } from 'child_process';
import * as vscode from 'vscode';

/**
 * Run `claude -p "instruction"` with context piped via stdin.
 *
 * Returns the generated commit message, or undefined if cancelled/errored.
 */
export function runClaude(
    instruction: string,
    context: string,
    cwd: string,
    cancellationToken: vscode.CancellationToken
): Promise<string | undefined> {
    return new Promise<string | undefined>((resolve) => {
        if (cancellationToken.isCancellationRequested) {
            resolve(undefined);
            return;
        }

        const child: ChildProcess = spawn('claude', ['-p', instruction], {
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
                const msg = stderr.trim() || `Process exited with code ${code}`;
                vscode.window.showErrorMessage(`Claude Commit: ${msg}`);
                settle(undefined);
                return;
            }

            settle(stdout);
        });

        child.on('error', (err: NodeJS.ErrnoException) => {
            cancelListener.dispose();

            if (err.code === 'ENOENT') {
                vscode.window.showErrorMessage(
                    'Claude Commit: "claude" CLI not found. Install Claude Code and ensure it is in your PATH.'
                );
            } else {
                vscode.window.showErrorMessage(
                    `Claude Commit: Failed to start Claude CLI: ${err.message}`
                );
            }
            settle(undefined);
        });

        child.stdin?.write(context);
        child.stdin?.end();
    });
}
