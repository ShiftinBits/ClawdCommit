import * as vscode from 'vscode';
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

/**
 * Format commits from the VSCode git API into the oneline format
 * expected by the prompt context (e.g. "abc1234 fix: correct null check").
 */
export function formatCommitLog(commits: { hash: string; message: string }[]): string {
    return commits
        .map((c) => `${c.hash.slice(0, 7)} ${c.message.split('\n')[0]}`)
        .join('\n');
}
