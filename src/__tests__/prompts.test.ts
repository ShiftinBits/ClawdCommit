import {
    buildAnalysisInstruction,
    buildAnalysisContext,
    buildSynthesisInstruction,
    buildSynthesisContext,
    buildSingleCallInstruction,
    buildSingleCallContext,
} from '../prompts';

describe('buildAnalysisInstruction', () => {
    it('returns a non-empty string', () => {
        const result = buildAnalysisInstruction();
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
    });

    it('mentions key analysis facets (WHAT, WHY, TYPE)', () => {
        const result = buildAnalysisInstruction();
        expect(result).toContain('WHAT');
        expect(result).toContain('WHY');
        expect(result).toContain('TYPE');
    });
});

describe('buildAnalysisContext', () => {
    it('includes the file path header', () => {
        const result = buildAnalysisContext('src/foo.ts', 'diff content', null);
        expect(result).toContain('=== FILE: src/foo.ts ===');
    });

    it('includes the diff section with provided diff text', () => {
        const diff = '+added line\n-removed line';
        const result = buildAnalysisContext('file.ts', diff, null);
        expect(result).toContain('=== DIFF ===');
        expect(result).toContain(diff);
    });

    it('includes the staged file content section with content', () => {
        const content = 'export function hello() { return "hi"; }';
        const result = buildAnalysisContext('file.ts', 'diff', content);
        expect(result).toContain('=== STAGED FILE CONTENT ===');
        expect(result).toContain(content);
    });

    it('shows "(not available)" when fileContent is null', () => {
        const result = buildAnalysisContext('file.ts', 'diff', null);
        expect(result).toContain('(not available)');
        expect(result).not.toContain('export');
    });
});

describe('buildSynthesisInstruction', () => {
    it('returns a non-empty string', () => {
        const result = buildSynthesisInstruction();
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
    });

    it('mentions conventional commit and subject line guidance', () => {
        const result = buildSynthesisInstruction();
        expect(result).toContain('conventional commit');
        expect(result).toContain('subject line');
    });
});

describe('buildSynthesisContext', () => {
    const sampleAnalyses = [
        { filePath: 'src/a.ts', analysis: 'Refactored helper function' },
        { filePath: 'src/b.ts', analysis: 'Added new endpoint' },
    ];

    it('includes per-file analyses under their file headers', () => {
        const result = buildSynthesisContext(sampleAnalyses, [], '');
        expect(result).toContain('=== PER-FILE ANALYSES ===');
        expect(result).toContain('--- src/a.ts ---');
        expect(result).toContain('Refactored helper function');
        expect(result).toContain('--- src/b.ts ---');
        expect(result).toContain('Added new endpoint');
    });

    it('lists binary files when present', () => {
        const result = buildSynthesisContext([], ['icon.png', 'logo.svg'], '');
        expect(result).toContain('=== BINARY FILES CHANGED ===');
        expect(result).toContain('icon.png');
        expect(result).toContain('logo.svg');
    });

    it('shows "(none)" when binary files list is empty', () => {
        const result = buildSynthesisContext(sampleAnalyses, [], '');
        expect(result).toContain('(none)');
    });

    it('includes recent commit log when provided', () => {
        const log = 'abc1234 fix: resolve race condition';
        const result = buildSynthesisContext(sampleAnalyses, [], log);
        expect(result).toContain('=== RECENT COMMITS ===');
        expect(result).toContain(log);
    });

    it('shows "(no history)" when log is empty', () => {
        const result = buildSynthesisContext(sampleAnalyses, [], '');
        expect(result).toContain('(no history)');
    });

    it('includes summary with correct file and binary counts', () => {
        const result = buildSynthesisContext(sampleAnalyses, ['icon.png'], '');
        expect(result).toContain('=== SUMMARY ===');
        expect(result).toContain('2 files analyzed');
        expect(result).toContain('1 binary files changed');
    });
});

describe('buildSingleCallInstruction', () => {
    it('returns a non-empty string', () => {
        const result = buildSingleCallInstruction();
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
    });

    it('mentions commit message and conventional commit style', () => {
        const result = buildSingleCallInstruction();
        expect(result).toContain('commit message');
        expect(result).toContain('conventional commit');
    });
});

describe('buildSingleCallContext', () => {
    it('includes the staged diff section', () => {
        const diff = '@@ -1,3 +1,4 @@\n+new line';
        const result = buildSingleCallContext(diff, '', null);
        expect(result).toContain('=== STAGED DIFF ===');
        expect(result).toContain(diff);
    });

    it('includes full file contents section when fileContexts are provided', () => {
        const contexts = [
            { filePath: 'src/index.ts', content: 'console.log("hello");' },
        ];
        const result = buildSingleCallContext('diff', '', contexts);
        expect(result).toContain('=== FULL FILE CONTENTS ===');
        expect(result).toContain('--- src/index.ts ---');
        expect(result).toContain('console.log("hello");');
    });

    it('omits file contents section when fileContexts is null', () => {
        const result = buildSingleCallContext('diff', '', null);
        expect(result).not.toContain('=== FULL FILE CONTENTS ===');
    });

    it('omits file contents section when fileContexts is empty array', () => {
        const result = buildSingleCallContext('diff', '', []);
        expect(result).not.toContain('=== FULL FILE CONTENTS ===');
    });

    it('includes recent commits section when log is non-empty', () => {
        const log = 'def5678 feat: add search feature';
        const result = buildSingleCallContext('diff', log, null);
        expect(result).toContain('=== RECENT COMMITS ===');
        expect(result).toContain(log);
    });

    it('omits recent commits section when log is empty or whitespace', () => {
        const result = buildSingleCallContext('diff', '   ', null);
        expect(result).not.toContain('=== RECENT COMMITS ===');
    });
});
