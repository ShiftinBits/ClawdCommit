import * as vscode from 'vscode';

/**
 * Extract the repository root URI from the argument VS Code passes when the
 * command is triggered from the SCM title menu. In a multi-repo workspace the
 * click carries a SourceControl (or the built-in git Repository), and each
 * exposes a `rootUri`. When the command is run from the palette/keybinding
 * no argument is passed — return undefined so the caller falls back to the
 * active-editor / first-repo heuristics.
 */
export function extractScmRootUri(arg: unknown): vscode.Uri | undefined {
    if (!arg || typeof arg !== 'object') {
        return undefined;
    }
    const rootUri = (arg as { rootUri?: unknown }).rootUri;
    if (rootUri && typeof rootUri === 'object' && 'fsPath' in rootUri) {
        return rootUri as vscode.Uri;
    }
    return undefined;
}
