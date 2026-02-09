export interface FileDiff {
    /** Destination file path (the "b" side). */
    filePath: string;
    /** Source file path if different (renames), null otherwise. */
    oldPath: string | null;
    /** The raw diff text for this file, including the "diff --git" header. */
    rawDiff: string;
    /** Change type. */
    status: 'added' | 'modified' | 'deleted' | 'renamed';
    /** Whether this is a binary file change. */
    isBinary: boolean;
}

/**
 * Parse a unified diff (from `git diff --staged`) into per-file segments.
 *
 * Splits on `diff --git a/... b/...` boundaries and extracts metadata
 * (file paths, change type, binary flag) from each segment.
 */
export function parseUnifiedDiff(diff: string): FileDiff[] {
    if (!diff.trim()) {
        return [];
    }

    // Split on "diff --git" boundaries, keeping each delimiter with its segment
    const segments = diff.split(/(?=^diff --git )/m).filter((s) => s.trim());

    return segments.map((segment) => parseSegment(segment));
}

function parseSegment(segment: string): FileDiff {
    const lines = segment.split('\n');

    // Extract file paths from +++ and --- lines (most reliable)
    let filePath: string | null = null;
    let oldPath: string | null = null;
    let status: FileDiff['status'] = 'modified';
    let isBinary = false;

    for (const line of lines) {
        if (line.startsWith('+++ b/')) {
            filePath = line.slice('+++ b/'.length);
        } else if (line.startsWith('--- a/')) {
            oldPath = line.slice('--- a/'.length);
        } else if (line.startsWith('+++ /dev/null')) {
            // Deleted file — filePath comes from --- line
            status = 'deleted';
        } else if (line.startsWith('--- /dev/null')) {
            // New file — filePath comes from +++ line
            status = 'added';
        } else if (line.startsWith('new file mode')) {
            status = 'added';
        } else if (line.startsWith('deleted file mode')) {
            status = 'deleted';
        } else if (line.startsWith('rename from ')) {
            oldPath = line.slice('rename from '.length);
            status = 'renamed';
        } else if (line.startsWith('rename to ')) {
            filePath = line.slice('rename to '.length);
            status = 'renamed';
        } else if (line.startsWith('Binary files') || line.startsWith('GIT binary patch')) {
            isBinary = true;
        }
    }

    // For deleted files, filePath is null (no +++ b/ line), use oldPath
    if (!filePath && oldPath) {
        filePath = oldPath;
    }

    // Last resort: parse from the diff --git header
    if (!filePath) {
        const headerMatch = lines[0]?.match(/^diff --git a\/(.+) b\/(.+)$/);
        if (headerMatch) {
            filePath = stripQuotes(headerMatch[2]);
            if (!oldPath) {
                oldPath = stripQuotes(headerMatch[1]);
            }
        }
    }

    // Clear oldPath if it matches filePath (not a rename)
    if (oldPath === filePath && status !== 'renamed') {
        oldPath = null;
    }

    return {
        filePath: filePath ?? '(unknown)',
        oldPath: status === 'renamed' ? oldPath : null,
        rawDiff: segment,
        status,
        isBinary,
    };
}

/** Strip surrounding double quotes from git-quoted paths. */
function stripQuotes(path: string): string {
    return path.replace(/^"(.*)"$/, '$1');
}
