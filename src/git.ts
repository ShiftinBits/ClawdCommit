import * as vscode from 'vscode';
import { execFile } from 'child_process';
import type { API, GitExtension, Repository } from './types/git';

/**
 * Resolve the appropriate git repository.
 *
 * Strategy:
 * 1. Get the git extension API
 * 2. If exactly one repository, use it
 * 3. If multiple, try to match the active editor's file
 * 4. Fall back to the first repository
 */
export function getGitRepository(): Repository | null {
    const gitExtension =
        vscode.extensions.getExtension<GitExtension>('vscode.git');

    if (!gitExtension) {
        vscode.window.showErrorMessage(
            'Git extension not found.'
        );
        return null;
    }

    if (!gitExtension.isActive) {
        vscode.window.showErrorMessage(
            'Git extension is not active.'
        );
        return null;
    }

    const api: API = gitExtension.exports.getAPI(1);

    if (api.repositories.length === 0) {
        vscode.window.showErrorMessage(
            'No git repository found in workspace.'
        );
        return null;
    }

    if (api.repositories.length === 1) {
        return api.repositories[0];
    }

    // Multi-root: try to match the active editor's file to a repository
    const activeUri = vscode.window.activeTextEditor?.document.uri;
    if (activeUri) {
        const matched = api.getRepository(activeUri);
        if (matched) {
            return matched;
        }
    }

    return api.repositories[0];
}

export function getStagedDiff(cwd: string, signal?: AbortSignal): Promise<string> {
    return runGitCommand(['diff', '--staged'], cwd, signal);
}

export function getRecentCommitLog(
    cwd: string,
    count: number,
    signal?: AbortSignal
): Promise<string> {
    return runGitCommand(['log', '--oneline', `-${count}`], cwd, signal);
}

/**
 * Get the staged (index) version of a file via `git show :path`.
 * Returns null if retrieval fails (deleted file, binary, too large, etc.).
 */
export function getStagedFileContent(
    filePath: string,
    cwd: string,
    signal?: AbortSignal
): Promise<string | null> {
    return new Promise((resolve) => {
        execFile(
            'git',
            ['show', `:${filePath}`],
            { cwd, maxBuffer: 512 * 1024, signal },
            (error, stdout) => {
                if (error) {
                    resolve(null);
                    return;
                }
                resolve(stdout);
            }
        );
    });
}

function runGitCommand(args: string[], cwd: string, signal?: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile(
            'git',
            args,
            { cwd, maxBuffer: 10 * 1024 * 1024, signal },
            (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(stderr.trim() || error.message));
                    return;
                }
                resolve(stdout);
            }
        );
    });
}
