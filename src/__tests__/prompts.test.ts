import {
    buildInstruction,
    buildContext,
} from '../prompts';

describe('buildInstruction', () => {
    it('returns a non-empty string', () => {
        const result = buildInstruction(true);
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
    });

    it('mentions commit message and conventional commit style', () => {
        const result = buildInstruction(true);
        expect(result).toContain('commit message');
        expect(result).toContain('conventional commit');
    });

    it('includes file exploration guidance when includeFileContext is true', () => {
        const result = buildInstruction(true);
        expect(result).toContain("read relevant files");
    });

    it('omits file exploration guidance when includeFileContext is false', () => {
        const result = buildInstruction(false);
        expect(result).not.toContain('read files');
    });
});

describe('buildContext', () => {
    it('includes the staged diff section', () => {
        const diff = '@@ -1,3 +1,4 @@\n+new line';
        const result = buildContext(diff, '');
        expect(result).toContain('=== STAGED DIFF ===');
        expect(result).toContain(diff);
    });

    it('includes recent commits section when log is non-empty', () => {
        const log = 'def5678 feat: add search feature';
        const result = buildContext('diff', log);
        expect(result).toContain('=== RECENT COMMITS ===');
        expect(result).toContain(log);
    });

    it('omits recent commits section when log is empty or whitespace', () => {
        const result = buildContext('diff', '   ');
        expect(result).not.toContain('=== RECENT COMMITS ===');
    });
});
