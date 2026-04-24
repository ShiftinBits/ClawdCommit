import {
    buildInstruction,
    buildContext,
    buildSystemPrompt,
} from '../prompts';

describe('buildSystemPrompt', () => {
    it('returns a non-empty string', () => {
        const result = buildSystemPrompt();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });

    it('establishes the commit-author role', () => {
        const result = buildSystemPrompt();
        expect(result.toLowerCase()).toContain('commit message');
    });

    it('forbids markdown/code fences and preamble', () => {
        const result = buildSystemPrompt();
        expect(result).toContain('ONLY the commit message');
        expect(result.toLowerCase()).toContain('no markdown');
        expect(result.toLowerCase()).toContain('no code fences');
    });

    it('enforces the 72-character subject rule', () => {
        const result = buildSystemPrompt();
        expect(result).toContain('72');
    });

    it('mentions Conventional Commits as a conditional style', () => {
        const result = buildSystemPrompt();
        expect(result).toContain('Conventional Commits');
    });

    it('instructs the model not to ask clarifying questions', () => {
        const result = buildSystemPrompt();
        expect(result.toLowerCase()).toContain('never ask');
    });

    it('stays lean (short enough to be CLI-arg friendly)', () => {
        const result = buildSystemPrompt();
        // Sanity check: meaningfully shorter than Claude Code's default agentic prompt.
        expect(result.length).toBeLessThan(2000);
    });
});

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

    it('omits file exploration guidance when canReadFiles is false even if includeFileContext is true', () => {
        const result = buildInstruction(true, false);
        expect(result).not.toContain('read relevant files');
    });

    it('includes file exploration guidance when both includeFileContext and canReadFiles are true', () => {
        const result = buildInstruction(true, true);
        expect(result).toContain('read relevant files');
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
