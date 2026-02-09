import { parseUnifiedDiff, FileDiff } from '../diffParser';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** A realistic diff for a newly added file. */
const ADDED_FILE_DIFF = `diff --git a/src/utils.ts b/src/utils.ts
new file mode 100644
index 0000000..a1b2c3d
--- /dev/null
+++ b/src/utils.ts
@@ -0,0 +1,5 @@
+export function clamp(val: number, min: number, max: number): number {
+    return Math.max(min, Math.min(max, val));
+}
`;

/** A realistic diff for a modified file. */
const MODIFIED_FILE_DIFF = `diff --git a/src/index.ts b/src/index.ts
index abc1234..def5678 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -10,6 +10,7 @@ import { activate } from './extension';

 export function greet(name: string): string {
-    return \`Hello, \${name}\`;
+    return \`Hello, \${name}!\`;
 }
`;

/** A realistic diff for a deleted file. */
const DELETED_FILE_DIFF = `diff --git a/src/old-module.ts b/src/old-module.ts
deleted file mode 100644
index 1234567..0000000
--- a/src/old-module.ts
+++ /dev/null
@@ -1,10 +0,0 @@
-export function deprecated() {
-    return 'gone';
-}
`;

/** A realistic diff for a renamed file. */
const RENAMED_FILE_DIFF = `diff --git a/src/helpers.ts b/src/utils/helpers.ts
similarity index 95%
rename from src/helpers.ts
rename to src/utils/helpers.ts
index abc1234..def5678 100644
--- a/src/helpers.ts
+++ b/src/utils/helpers.ts
@@ -1,4 +1,4 @@
-export function helper() {
+export function helperV2() {
     return true;
 }
`;

/** A realistic diff for a binary file change via "Binary files" line. */
const BINARY_FILE_DIFF = `diff --git a/assets/logo.png b/assets/logo.png
index 1111111..2222222 100644
Binary files a/assets/logo.png and b/assets/logo.png differ
`;

/** A realistic diff for a binary file change via "GIT binary patch" line. */
const GIT_BINARY_PATCH_DIFF = `diff --git a/assets/icon.ico b/assets/icon.ico
new file mode 100644
index 0000000..3333333
GIT binary patch
literal 1234
zcmV;@1234abc
`;

/** A diff with multiple files combined. */
const MULTI_FILE_DIFF = [ADDED_FILE_DIFF, MODIFIED_FILE_DIFF, DELETED_FILE_DIFF].join('');

/** A diff segment with no +++ or --- lines, forcing fallback to header parsing. */
const FALLBACK_HEADER_DIFF = `diff --git a/config.json b/config.json
index aaa1111..bbb2222 100644
@@ -1 +1 @@
-{"key":"old"}
+{"key":"new"}
`;

/** A diff segment with quoted paths in the header. */
const QUOTED_PATH_DIFF = `diff --git a/"path with spaces/file.ts" b/"path with spaces/file.ts"
index 1234567..abcdefg 100644
@@ -1 +1 @@
-old
+new
`;


// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseUnifiedDiff', () => {
    describe('empty / whitespace input', () => {
        it('returns an empty array for empty string', () => {
            expect(parseUnifiedDiff('')).toEqual([]);
        });

        it('returns an empty array for whitespace-only string', () => {
            expect(parseUnifiedDiff('   \n\n  \t  ')).toEqual([]);
        });
    });

    describe('added file', () => {
        let result: FileDiff[];

        beforeEach(() => {
            result = parseUnifiedDiff(ADDED_FILE_DIFF);
        });

        it('detects status as added', () => {
            expect(result[0].status).toBe('added');
        });

        it('extracts filePath from "+++ b/" line', () => {
            expect(result[0].filePath).toBe('src/utils.ts');
        });

        it('sets oldPath to null for a new file', () => {
            expect(result[0].oldPath).toBeNull();
        });

        it('is not binary', () => {
            expect(result[0].isBinary).toBe(false);
        });
    });

    describe('modified file', () => {
        let result: FileDiff[];

        beforeEach(() => {
            result = parseUnifiedDiff(MODIFIED_FILE_DIFF);
        });

        it('defaults status to modified', () => {
            expect(result[0].status).toBe('modified');
        });

        it('extracts filePath correctly', () => {
            expect(result[0].filePath).toBe('src/index.ts');
        });

        it('clears oldPath when it matches filePath (not a rename)', () => {
            expect(result[0].oldPath).toBeNull();
        });

        it('preserves the raw diff text', () => {
            expect(result[0].rawDiff).toContain('diff --git');
            expect(result[0].rawDiff).toContain('Hello');
        });
    });

    describe('deleted file', () => {
        let result: FileDiff[];

        beforeEach(() => {
            result = parseUnifiedDiff(DELETED_FILE_DIFF);
        });

        it('detects status as deleted', () => {
            expect(result[0].status).toBe('deleted');
        });

        it('falls back filePath to oldPath when +++ is /dev/null', () => {
            expect(result[0].filePath).toBe('src/old-module.ts');
        });

        it('sets oldPath to null (not a rename)', () => {
            expect(result[0].oldPath).toBeNull();
        });
    });

    describe('renamed file', () => {
        let result: FileDiff[];

        beforeEach(() => {
            result = parseUnifiedDiff(RENAMED_FILE_DIFF);
        });

        it('detects status as renamed', () => {
            expect(result[0].status).toBe('renamed');
        });

        it('extracts new filePath from "rename to" line', () => {
            expect(result[0].filePath).toBe('src/utils/helpers.ts');
        });

        it('preserves oldPath from "rename from" line', () => {
            expect(result[0].oldPath).toBe('src/helpers.ts');
        });
    });

    describe('binary files', () => {
        it('detects binary from "Binary files" line', () => {
            const result = parseUnifiedDiff(BINARY_FILE_DIFF);
            expect(result[0].isBinary).toBe(true);
            expect(result[0].filePath).toBe('assets/logo.png');
        });

        it('detects binary from "GIT binary patch" line', () => {
            const result = parseUnifiedDiff(GIT_BINARY_PATCH_DIFF);
            expect(result[0].isBinary).toBe(true);
            expect(result[0].status).toBe('added');
        });
    });

    describe('multiple files', () => {
        let result: FileDiff[];

        beforeEach(() => {
            result = parseUnifiedDiff(MULTI_FILE_DIFF);
        });

        it('splits into the correct number of segments', () => {
            expect(result).toHaveLength(3);
        });

        it('parses each file with the correct filePath', () => {
            expect(result[0].filePath).toBe('src/utils.ts');
            expect(result[1].filePath).toBe('src/index.ts');
            expect(result[2].filePath).toBe('src/old-module.ts');
        });

        it('assigns the correct status to each file', () => {
            expect(result[0].status).toBe('added');
            expect(result[1].status).toBe('modified');
            expect(result[2].status).toBe('deleted');
        });

        it('each segment contains its own rawDiff', () => {
            expect(result[0].rawDiff).toContain('src/utils.ts');
            expect(result[1].rawDiff).toContain('src/index.ts');
            expect(result[2].rawDiff).toContain('src/old-module.ts');
        });
    });

    describe('fallback header parsing', () => {
        it('uses diff --git header when +++ and --- lines are missing', () => {
            const result = parseUnifiedDiff(FALLBACK_HEADER_DIFF);
            expect(result[0].filePath).toBe('config.json');
        });

        it('strips surrounding double quotes from paths in the header', () => {
            const result = parseUnifiedDiff(QUOTED_PATH_DIFF);
            expect(result[0].filePath).toBe('path with spaces/file.ts');
        });

        it('returns "(unknown)" when no path can be determined', () => {
            // Wrap in a diff --git boundary so the segment is processed
            const noDiffHeader = 'diff --git something\nno useful info here\n';
            const result = parseUnifiedDiff(noDiffHeader);
            expect(result[0].filePath).toBe('(unknown)');
        });
    });
});
