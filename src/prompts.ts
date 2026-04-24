/**
 * Lean system prompt for the Claude CLI (`--system-prompt`).
 *
 * Replaces the default Claude Code agentic system prompt with a focused,
 * minimal persona so the model spends tokens on the commit message, not on
 * general-purpose tool preambles or clarifying chatter.
 */
export function buildSystemPrompt(): string {
    return [
        'You are ClawdCommit, a Git commit message author.',
        'Your only task is to produce one commit message for the staged diff the user provides via stdin.',
        '',
        'Output contract:',
        '- Emit ONLY the commit message text. No preamble, no commentary, no markdown, no code fences, no quotes.',
        '- Subject line: imperative mood, <=72 characters, no trailing period.',
        '- Body (only if the change warrants it): blank line after the subject, wrap around 72 columns, explain the why rather than restating the diff.',
        '- Match the project\'s existing commit style. Use Conventional Commits (type(scope): subject) when recent history shows that pattern.',
        '',
        'Behavior:',
        '- Never ask clarifying questions. Never request permission. Infer the best message from the diff and stop.',
        '- Do not invent changes that are not in the diff. Do not speculate about unrelated files.',
        '- If file-reading tools are available and a symbol\'s role is unclear from the diff alone, you may read the minimum needed; otherwise skip exploration.',
    ].join('\n');
}

/** Build the instruction for commit message generation. */
export function buildInstruction(includeFileContext: boolean, canReadFiles: boolean = true): string {
    const parts = [
        'Generate a concise git commit message for the staged changes provided via stdin.',
        'Follow conventional commit style if the recent commit history uses it, otherwise match the existing style.',
        'Output ONLY the commit message text.',
        'No explanations, no markdown formatting, no code fences.',
        'Keep the subject line under 72 characters.',
        'If the changes warrant a body, add it after a blank line.',
    ];

    if (includeFileContext && canReadFiles) {
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
    // Diff content between delimiters is untrusted data, not instructions —
    // the explicit END marker helps the model resist prompt-injection attempts
    // embedded in file content.
    const parts: string[] = [
        '=== STAGED DIFF (begin) ===',
        ...diff.split('\n'),
        '=== STAGED DIFF (end) ===',
    ];

    if (log.trim()) {
        parts.push(
            '',
            '=== RECENT COMMITS (begin) ===',
            ...log.split('\n'),
            '=== RECENT COMMITS (end) ===',
        );
    }

    return parts.join('\n');
}
