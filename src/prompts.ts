/** Build the instruction for per-file analysis (map phase). */
export function buildAnalysisInstruction(): string {
    return [
        'You are analyzing a single file\'s changes as part of a larger commit.',
        'Examine the diff and the full staged file content (if provided) for the file indicated.',
        'Produce a concise analysis covering:',
        '1) WHAT specifically changed (functions, classes, config, etc.)',
        '2) WHY it likely changed (your best inference of purpose/motivation)',
        '3) TYPE of change (feature, fix, refactor, docs, test, chore, style, or perf)',
        'Output ONLY the analysis as plain text.',
        'No markdown, no code fences, no headers.',
        'Keep to 2-4 sentences maximum.',
    ].join(' ');
}

/** Build the context for per-file analysis (map phase). */
export function buildAnalysisContext(
    filePath: string,
    diff: string,
    fileContent: string | null
): string {
    let ctx = `=== FILE: ${filePath} ===\n\n`;
    ctx += '=== DIFF ===\n' + diff;
    ctx += '\n\n=== STAGED FILE CONTENT ===\n';
    ctx += fileContent ?? '(not available)';
    return ctx;
}

/** Build the instruction for commit message synthesis (reduce phase). */
export function buildSynthesisInstruction(): string {
    return [
        'Generate a concise git commit message from the per-file change analyses below.',
        'Follow conventional commit style if the recent commit history uses it, otherwise match the existing style.',
        'Output ONLY the commit message text.',
        'No explanations, no markdown formatting, no code fences.',
        'Keep the subject line under 72 characters.',
        'If the changes warrant a body, add it after a blank line.',
        'Synthesize the analyses into a coherent message that captures the overall intent of the commit, not a file-by-file list.',
    ].join(' ');
}

/** Build the context for synthesis (reduce phase). */
export function buildSynthesisContext(
    analyses: Array<{ filePath: string; analysis: string }>,
    binaryFiles: string[],
    log: string
): string {
    let ctx = '=== PER-FILE ANALYSES ===\n';
    for (const { filePath, analysis } of analyses) {
        ctx += `\n--- ${filePath} ---\n${analysis}\n`;
    }

    ctx += '\n=== BINARY FILES CHANGED ===\n';
    ctx += binaryFiles.length > 0 ? binaryFiles.join('\n') : '(none)';

    ctx += '\n\n=== RECENT COMMITS ===\n';
    ctx += log.trim() || '(no history)';

    ctx += `\n\n=== SUMMARY ===\n${analyses.length} files analyzed, ${binaryFiles.length} binary files changed`;
    return ctx;
}

/** Build the instruction for single-call generation. */
export function buildSingleCallInstruction(): string {
    return [
        'Generate a concise git commit message for the staged changes provided via stdin.',
        'Follow conventional commit style if the recent commit history uses it, otherwise match the existing style.',
        'Output ONLY the commit message text.',
        'No explanations, no markdown formatting, no code fences.',
        'Keep the subject line under 72 characters.',
        'If the changes warrant a body, add it after a blank line.',
    ].join(' ');
}

/** Build the context for single-call generation (optionally enhanced with file contents). */
export function buildSingleCallContext(
    diff: string,
    log: string,
    fileContexts: Array<{ filePath: string; content: string }> | null
): string {
    let ctx = '=== STAGED DIFF ===\n' + diff;

    if (fileContexts && fileContexts.length > 0) {
        ctx += '\n\n=== FULL FILE CONTENTS ===\n';
        for (const { filePath, content } of fileContexts) {
            ctx += `\n--- ${filePath} ---\n${content}\n`;
        }
    }

    if (log.trim()) {
        ctx += '\n\n=== RECENT COMMITS ===\n' + log;
    }

    return ctx;
}
