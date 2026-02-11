/** Build the instruction for commit message generation. */
export function buildInstruction(includeFileContext: boolean): string {
    const parts = [
        'Generate a concise git commit message for the staged changes provided via stdin.',
        'Follow conventional commit style if the recent commit history uses it, otherwise match the existing style.',
        'Output ONLY the commit message text.',
        'No explanations, no markdown formatting, no code fences.',
        'Keep the subject line under 72 characters.',
        'If the changes warrant a body, add it after a blank line.',
    ];

    if (includeFileContext) {
        parts.push(
            'You are encouraged to read relevant files in the working directory to better understand the context of the changes.',
        );
    }

    return parts.join('\n');
}

/** Build the context for commit message generation. */
export function buildContext(
    diff: string,
    log: string
): string {
    const parts: string[] = ['=== STAGED DIFF ===', ...diff.split('\n')];

    if (log.trim()) {
        parts.push("\n\n=== RECENT COMMITS ===", ...log.split("\n"));
    }

    return parts.join('\n');
}
