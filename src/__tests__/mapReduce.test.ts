jest.mock('../claude');
jest.mock('../git');
jest.mock('../concurrency');
jest.mock('../prompts');

import { mapReduceGenerate } from '../mapReduce';
import { runClaude } from '../claude';
import { getStagedFileContent } from '../git';
import { mapWithConcurrency } from '../concurrency';
import {
    buildAnalysisInstruction,
    buildAnalysisContext,
    buildSynthesisInstruction,
    buildSynthesisContext,
} from '../prompts';
import type { FileDiff } from '../diffParser';
import type { ClawdCommitSettings } from '../settings';
import { createMockCancellationToken, type MockCancellationToken } from './helpers/mockCancellationToken';

const mockRunClaude = runClaude as jest.MockedFunction<typeof runClaude>;
const mockGetStagedFileContent = getStagedFileContent as jest.MockedFunction<typeof getStagedFileContent>;
const mockMapWithConcurrency = mapWithConcurrency as jest.MockedFunction<typeof mapWithConcurrency>;
const mockBuildAnalysisInstruction = buildAnalysisInstruction as jest.MockedFunction<typeof buildAnalysisInstruction>;
const mockBuildAnalysisContext = buildAnalysisContext as jest.MockedFunction<typeof buildAnalysisContext>;
const mockBuildSynthesisInstruction = buildSynthesisInstruction as jest.MockedFunction<typeof buildSynthesisInstruction>;
const mockBuildSynthesisContext = buildSynthesisContext as jest.MockedFunction<typeof buildSynthesisContext>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFileDiff(overrides: Partial<FileDiff> = {}): FileDiff {
    return {
        filePath: 'src/foo.ts',
        oldPath: null,
        rawDiff: 'diff --git a/src/foo.ts b/src/foo.ts\n+new line',
        status: 'modified',
        isBinary: false,
        ...overrides,
    };
}

function makeSettings(overrides: Partial<ClawdCommitSettings> = {}): ClawdCommitSettings {
    return {
        analysisModel: 'haiku',
        synthesisModel: 'sonnet',
        singleCallModel: 'sonnet',
        parallelFileThreshold: 4,
        maxConcurrentAgents: 5,
        includeFileContext: true,
        ...overrides,
    };
}

function makeProgress() {
    return { report: jest.fn() };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let token: MockCancellationToken;
let progress: ReturnType<typeof makeProgress>;

beforeEach(() => {
    token = createMockCancellationToken();
    progress = makeProgress();

    // Default passthrough mock for mapWithConcurrency — calls fn for each item
    mockMapWithConcurrency.mockImplementation(
        async (items: unknown[], _concurrency: number, fn: (item: any, index: number) => Promise<unknown>, tkn: any) => {
            const results = [];
            for (let i = 0; i < items.length; i++) {
                if (tkn.isCancellationRequested) {
                    results.push(null);
                } else {
                    results.push(await fn(items[i], i));
                }
            }
            return results;
        }
    );

    mockBuildAnalysisInstruction.mockReturnValue('analyze instruction');
    mockBuildAnalysisContext.mockReturnValue('analysis context');
    mockBuildSynthesisInstruction.mockReturnValue('synthesis instruction');
    mockBuildSynthesisContext.mockReturnValue('synthesis context');
    mockGetStagedFileContent.mockResolvedValue('file content');
    mockRunClaude.mockResolvedValue('feat: add feature');
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mapReduceGenerate', () => {
    it('returns null when all files are binary', async () => {
        const files = [makeFileDiff({ isBinary: true }), makeFileDiff({ filePath: 'img.png', isBinary: true })];
        const result = await mapReduceGenerate(files, '', '/cwd', makeSettings(), progress, token as any);
        expect(result).toBeNull();
        expect(mockRunClaude).not.toHaveBeenCalled();
    });

    it('fetches staged file content when includeFileContext is true', async () => {
        const files = [makeFileDiff(), makeFileDiff({ filePath: 'src/bar.ts' })];
        await mapReduceGenerate(files, '', '/cwd', makeSettings({ includeFileContext: true }), progress, token as any);
        // mapWithConcurrency is called first for content fetch, then for analysis
        expect(mockMapWithConcurrency).toHaveBeenCalledTimes(2);
    });

    it('skips file content fetch when includeFileContext is false', async () => {
        const files = [makeFileDiff()];
        await mapReduceGenerate(files, '', '/cwd', makeSettings({ includeFileContext: false }), progress, token as any);
        // Only the analysis call to mapWithConcurrency
        expect(mockMapWithConcurrency).toHaveBeenCalledTimes(1);
    });

    it('skips getStagedFileContent for deleted files', async () => {
        const files = [makeFileDiff({ status: 'deleted' })];
        await mapReduceGenerate(files, '', '/cwd', makeSettings(), progress, token as any);
        expect(mockGetStagedFileContent).not.toHaveBeenCalled();
    });

    it('returns undefined when cancelled after content fetch', async () => {
        let callCount = 0;
        mockMapWithConcurrency.mockImplementation(async (items: unknown[], _c: number, fn: any, _tkn: any) => {
            callCount++;
            if (callCount === 1) {
                // Content fetch succeeds, then cancel
                const results = [];
                for (let i = 0; i < items.length; i++) {
                    results.push(await fn(items[i], i));
                }
                token.cancel();
                return results;
            }
            // Analysis phase — should see cancellation
            return items.map(() => null);
        });

        const files = [makeFileDiff()];
        const result = await mapReduceGenerate(files, '', '/cwd', makeSettings(), progress, token as any);
        expect(result).toBeUndefined();
    });

    it('calls runClaude for each non-binary file with silent and analysisModel', async () => {
        const files = [
            makeFileDiff({ filePath: 'a.ts' }),
            makeFileDiff({ filePath: 'b.ts' }),
            makeFileDiff({ filePath: 'c.png', isBinary: true }),
        ];
        await mapReduceGenerate(files, '', '/cwd', makeSettings({ analysisModel: 'haiku' }), progress, token as any);

        // runClaude called for a.ts and b.ts analysis + 1 synthesis = 3
        const analysisCalls = mockRunClaude.mock.calls.filter(
            (call) => call[4]?.silent === true
        );
        expect(analysisCalls).toHaveLength(2);
        expect(analysisCalls[0][4]?.model).toBe('haiku');
    });

    it('uses placeholder when analysis agent fails but not cancelled', async () => {
        mockRunClaude.mockResolvedValueOnce(undefined); // analysis fails
        mockRunClaude.mockResolvedValueOnce('synthesized message'); // synthesis succeeds

        const files = [makeFileDiff({ filePath: 'fail.ts' })];
        await mapReduceGenerate(files, '', '/cwd', makeSettings(), progress, token as any);

        // Synthesis should receive the placeholder
        expect(mockBuildSynthesisContext).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ analysis: expect.stringContaining('[Analysis unavailable]') }),
            ]),
            expect.any(Array),
            expect.any(String)
        );
    });

    it('returns null when all analysis agents fail', async () => {
        mockRunClaude.mockResolvedValue(undefined);
        token.isCancellationRequested = false; // ensure not cancelled

        const files = [makeFileDiff(), makeFileDiff({ filePath: 'b.ts' })];

        // Override passthrough to simulate all failures without cancellation
        mockMapWithConcurrency.mockImplementation(async (items: unknown[], _c: number, fn: any, _tkn: any) => {
            const results = [];
            for (let i = 0; i < items.length; i++) {
                results.push(await fn(items[i], i));
            }
            return results;
        });

        // When agents return undefined (fail) but not cancelled, they produce placeholder
        // objects. To test the "all fail → null" path, we need mapWithConcurrency to
        // return all nulls (simulating all tasks being cancelled/dropped).
        mockMapWithConcurrency.mockReset();
        let callIdx = 0;
        mockMapWithConcurrency.mockImplementation(async (items: unknown[], _c: number, fn: any, _tkn: any) => {
            callIdx++;
            if (callIdx === 1) {
                // Content fetch
                const results = [];
                for (let i = 0; i < items.length; i++) {
                    results.push(await fn(items[i], i));
                }
                return results;
            }
            // Analysis — all return null
            return items.map(() => null);
        });

        const result2 = await mapReduceGenerate(files, '', '/cwd', makeSettings(), progress, token as any);
        expect(result2).toBeNull();
    });

    it('calls runClaude for synthesis with correct model', async () => {
        const files = [makeFileDiff()];
        await mapReduceGenerate(files, 'abc123 commit', '/cwd', makeSettings({ synthesisModel: 'opus' }), progress, token as any);

        const synthesisCalls = mockRunClaude.mock.calls.filter(
            (call) => call[4]?.silent !== true
        );
        expect(synthesisCalls).toHaveLength(1);
        expect(synthesisCalls[0][4]?.model).toBe('opus');
    });

    it('includes binary files in synthesis context', async () => {
        const files = [
            makeFileDiff({ filePath: 'src/a.ts' }),
            makeFileDiff({ filePath: 'image.png', isBinary: true }),
        ];
        await mapReduceGenerate(files, '', '/cwd', makeSettings(), progress, token as any);

        expect(mockBuildSynthesisContext).toHaveBeenCalledWith(
            expect.any(Array),
            ['image.png'],
            expect.any(String)
        );
    });

    it('reports progress during analysis phase', async () => {
        const files = [makeFileDiff({ filePath: 'a.ts' }), makeFileDiff({ filePath: 'b.ts' })];
        await mapReduceGenerate(files, '', '/cwd', makeSettings(), progress, token as any);

        const reportCalls = progress.report.mock.calls;
        const analysisCalls = reportCalls.filter(
            (call: any[]) => call[0].message && call[0].message.includes('Analyzing file')
        );
        expect(analysisCalls.length).toBeGreaterThanOrEqual(2);
    });

    it('reports progress for synthesis phase', async () => {
        const files = [makeFileDiff()];
        await mapReduceGenerate(files, '', '/cwd', makeSettings(), progress, token as any);

        const reportCalls = progress.report.mock.calls;
        const synthCall = reportCalls.find(
            (call: any[]) => call[0].message === 'Synthesizing commit message'
        );
        expect(synthCall).toBeDefined();
    });

    it('returns synthesis result on success', async () => {
        mockRunClaude
            .mockResolvedValueOnce('analysis of file')  // analysis
            .mockResolvedValueOnce('feat: add new feature'); // synthesis

        const files = [makeFileDiff()];
        const result = await mapReduceGenerate(files, '', '/cwd', makeSettings(), progress, token as any);
        expect(result).toBe('feat: add new feature');
    });

    it('returns null when synthesis fails and not cancelled', async () => {
        mockRunClaude
            .mockResolvedValueOnce('analysis ok') // analysis
            .mockResolvedValueOnce(undefined);     // synthesis fails

        const files = [makeFileDiff()];
        const result = await mapReduceGenerate(files, '', '/cwd', makeSettings(), progress, token as any);
        expect(result).toBeNull();
    });

    it('returns undefined when synthesis fails and token is cancelled', async () => {
        mockRunClaude
            .mockResolvedValueOnce('analysis ok') // analysis
            .mockImplementationOnce(async () => {  // synthesis
                token.cancel();
                return undefined;
            });

        const files = [makeFileDiff()];
        const result = await mapReduceGenerate(files, '', '/cwd', makeSettings(), progress, token as any);
        expect(result).toBeUndefined();
    });

    it('passes log to synthesis context', async () => {
        const files = [makeFileDiff()];
        await mapReduceGenerate(files, 'abc123 recent commit', '/cwd', makeSettings(), progress, token as any);

        expect(mockBuildSynthesisContext).toHaveBeenCalledWith(
            expect.any(Array),
            expect.any(Array),
            'abc123 recent commit'
        );
    });
});
