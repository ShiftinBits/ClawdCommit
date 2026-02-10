jest.mock('../git');
jest.mock('../claude');
jest.mock('../diffParser');
jest.mock('../settings');
jest.mock('../prompts');
jest.mock('../mapReduce');

import * as vscode from 'vscode';
import { generateCommitMessage } from '../generateCommitMessage';
import { getGitRepository, getStagedDiff, getStagedFileContent, getRecentCommitLog } from '../git';
import { runClaude } from '../claude';
import { parseUnifiedDiff } from '../diffParser';
import { getSettings } from '../settings';
import { buildSingleCallInstruction, buildSingleCallContext } from '../prompts';
import { mapReduceGenerate } from '../mapReduce';
import type { FileDiff } from '../diffParser';
import { createMockCancellationToken } from './helpers/mockCancellationToken';

const mockGetGitRepository = getGitRepository as jest.MockedFunction<typeof getGitRepository>;
const mockGetStagedDiff = getStagedDiff as jest.MockedFunction<typeof getStagedDiff>;
const mockGetStagedFileContent = getStagedFileContent as jest.MockedFunction<typeof getStagedFileContent>;
const mockGetRecentCommitLog = getRecentCommitLog as jest.MockedFunction<typeof getRecentCommitLog>;
const mockRunClaude = runClaude as jest.MockedFunction<typeof runClaude>;
const mockParseUnifiedDiff = parseUnifiedDiff as jest.MockedFunction<typeof parseUnifiedDiff>;
const mockGetSettings = getSettings as jest.MockedFunction<typeof getSettings>;
const mockBuildSingleCallInstruction = buildSingleCallInstruction as jest.MockedFunction<typeof buildSingleCallInstruction>;
const mockBuildSingleCallContext = buildSingleCallContext as jest.MockedFunction<typeof buildSingleCallContext>;
const mockMapReduceGenerate = mapReduceGenerate as jest.MockedFunction<typeof mapReduceGenerate>;
const mockWithProgress = vscode.window.withProgress as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFileDiff(overrides: Partial<FileDiff> = {}): FileDiff {
    return {
        filePath: 'src/foo.ts',
        oldPath: null,
        rawDiff: 'diff content',
        status: 'modified',
        isBinary: false,
        ...overrides,
    };
}

let mockRepo: { rootUri: { fsPath: string }; inputBox: { value: string } };

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    mockRepo = { rootUri: { fsPath: '/repo' }, inputBox: { value: '' } };

    mockGetGitRepository.mockReturnValue(mockRepo as any);
    mockGetStagedDiff.mockResolvedValue('diff --git a/f.ts b/f.ts\n+line');
    mockGetRecentCommitLog.mockResolvedValue('abc123 previous commit');
    mockParseUnifiedDiff.mockReturnValue([makeFileDiff(), makeFileDiff({ filePath: 'src/bar.ts' })]);
    mockGetSettings.mockReturnValue({
        analysisModel: 'haiku',
        synthesisModel: 'sonnet',
        singleCallModel: 'sonnet',
        parallelFileThreshold: 4,
        maxConcurrentAgents: 5,
        includeFileContext: true,
    });
    mockRunClaude.mockResolvedValue('fix: correct null check');
    mockGetStagedFileContent.mockResolvedValue('file content');
    mockBuildSingleCallInstruction.mockReturnValue('instruction');
    mockBuildSingleCallContext.mockReturnValue('context');
    mockMapReduceGenerate.mockResolvedValue('feat: map-reduce result');

    // withProgress: invoke callback directly with mock progress/token
    mockWithProgress.mockImplementation(async (_opts: unknown, task: Function) => {
        const progress = { report: jest.fn() };
        const token = createMockCancellationToken();
        return task(progress, token);
    });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateCommitMessage', () => {
    describe('early exits', () => {
        it('returns early when getGitRepository returns null', async () => {
            mockGetGitRepository.mockReturnValue(null);
            await generateCommitMessage();
            expect(mockGetStagedDiff).not.toHaveBeenCalled();
        });

        it('shows error and returns when getStagedDiff rejects', async () => {
            mockGetStagedDiff.mockRejectedValue(new Error('fatal: not a git repo'));
            await generateCommitMessage();
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('fatal: not a git repo')
            );
            expect(mockRepo.inputBox.value).toBe('');
        });

        it('shows warning when diff is empty', async () => {
            mockGetStagedDiff.mockResolvedValue('');
            await generateCommitMessage();
            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                expect.stringContaining('No staged changes')
            );
        });

        it('shows warning when diff is whitespace only', async () => {
            mockGetStagedDiff.mockResolvedValue('  \n  ');
            await generateCommitMessage();
            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                expect.stringContaining('No staged changes')
            );
        });
    });

    describe('path dispatch', () => {
        it('uses single-call when file count < parallelFileThreshold', async () => {
            // 2 files, threshold 4 → single-call
            mockParseUnifiedDiff.mockReturnValue([makeFileDiff(), makeFileDiff({ filePath: 'b.ts' })]);
            await generateCommitMessage();
            expect(mockRunClaude).toHaveBeenCalled();
            expect(mockMapReduceGenerate).not.toHaveBeenCalled();
        });

        it('uses map-reduce when file count >= parallelFileThreshold', async () => {
            mockParseUnifiedDiff.mockReturnValue([
                makeFileDiff({ filePath: 'a.ts' }),
                makeFileDiff({ filePath: 'b.ts' }),
                makeFileDiff({ filePath: 'c.ts' }),
                makeFileDiff({ filePath: 'd.ts' }),
            ]);
            mockGetSettings.mockReturnValue({
                analysisModel: 'haiku',
                synthesisModel: 'sonnet',
                singleCallModel: 'sonnet',
                parallelFileThreshold: 4,
                maxConcurrentAgents: 5,
                includeFileContext: true,
            });
            await generateCommitMessage();
            expect(mockMapReduceGenerate).toHaveBeenCalled();
        });

        it('falls back to single-call when map-reduce returns null', async () => {
            mockParseUnifiedDiff.mockReturnValue([
                makeFileDiff({ filePath: 'a.ts' }),
                makeFileDiff({ filePath: 'b.ts' }),
                makeFileDiff({ filePath: 'c.ts' }),
                makeFileDiff({ filePath: 'd.ts' }),
            ]);
            mockMapReduceGenerate.mockResolvedValue(null);
            await generateCommitMessage();
            expect(mockMapReduceGenerate).toHaveBeenCalled();
            expect(mockRunClaude).toHaveBeenCalled(); // fallback
        });

        it('does NOT fall back when map-reduce returns undefined (cancelled)', async () => {
            mockParseUnifiedDiff.mockReturnValue([
                makeFileDiff({ filePath: 'a.ts' }),
                makeFileDiff({ filePath: 'b.ts' }),
                makeFileDiff({ filePath: 'c.ts' }),
                makeFileDiff({ filePath: 'd.ts' }),
            ]);
            mockMapReduceGenerate.mockResolvedValue(undefined);
            await generateCommitMessage();
            expect(mockMapReduceGenerate).toHaveBeenCalled();
            expect(mockRunClaude).not.toHaveBeenCalled();
            expect(mockRepo.inputBox.value).toBe('');
        });
    });

    describe('error resilience', () => {
        it('falls through to single-call when parseUnifiedDiff throws', async () => {
            mockParseUnifiedDiff.mockImplementation(() => {
                throw new Error('parse error');
            });
            await generateCommitMessage();
            // fileDiffs=[], 0 < threshold → single-call path
            expect(mockRunClaude).toHaveBeenCalled();
            expect(mockMapReduceGenerate).not.toHaveBeenCalled();
        });

        it('ignores getRecentCommitLog failure', async () => {
            mockGetRecentCommitLog.mockRejectedValue(new Error('no commits'));
            await generateCommitMessage();
            // Should still complete successfully
            expect(mockRunClaude).toHaveBeenCalled();
            expect(mockRepo.inputBox.value).toBe('fix: correct null check');
        });
    });

    describe('output handling', () => {
        it('sets inputBox.value on successful generation', async () => {
            mockRunClaude.mockResolvedValue('fix: correct null check');
            await generateCommitMessage();
            expect(mockRepo.inputBox.value).toBe('fix: correct null check');
        });

        it('strips code fences from result', async () => {
            mockRunClaude.mockResolvedValue('```\nfix: correct null check\n```');
            await generateCommitMessage();
            expect(mockRepo.inputBox.value).toBe('fix: correct null check');
        });

        it('strips code fences with language tag', async () => {
            mockRunClaude.mockResolvedValue('```text\nfix: correct null check\n```');
            await generateCommitMessage();
            expect(mockRepo.inputBox.value).toBe('fix: correct null check');
        });

        it('shows warning on empty response', async () => {
            mockRunClaude.mockResolvedValue('   ');
            await generateCommitMessage();
            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                expect.stringContaining('empty response')
            );
            expect(mockRepo.inputBox.value).toBe('');
        });

        it('does not set inputBox when result is undefined', async () => {
            mockRunClaude.mockResolvedValue(undefined);
            await generateCommitMessage();
            expect(mockRepo.inputBox.value).toBe('');
        });
    });

    describe('singleCallGenerate', () => {
        it('fetches file content when includeFileContext is true', async () => {
            mockParseUnifiedDiff.mockReturnValue([makeFileDiff()]);
            await generateCommitMessage();
            expect(mockGetStagedFileContent).toHaveBeenCalled();
        });

        it('skips file content fetch when includeFileContext is false', async () => {
            mockGetSettings.mockReturnValue({
                analysisModel: 'haiku',
                synthesisModel: 'sonnet',
                singleCallModel: 'sonnet',
                parallelFileThreshold: 4,
                maxConcurrentAgents: 5,
                includeFileContext: false,
            });
            mockParseUnifiedDiff.mockReturnValue([makeFileDiff()]);
            await generateCommitMessage();
            expect(mockGetStagedFileContent).not.toHaveBeenCalled();
        });

        it('excludes binary and deleted files from file content fetch', async () => {
            mockParseUnifiedDiff.mockReturnValue([
                makeFileDiff({ filePath: 'a.ts' }),
                makeFileDiff({ filePath: 'b.png', isBinary: true }),
                makeFileDiff({ filePath: 'c.ts', status: 'deleted' }),
            ]);
            await generateCommitMessage();
            // Only a.ts should trigger a fetch
            expect(mockGetStagedFileContent).toHaveBeenCalledTimes(1);
            expect(mockGetStagedFileContent).toHaveBeenCalledWith('a.ts', '/repo', expect.any(AbortSignal));
        });

        it('handles null content from getStagedFileContent', async () => {
            mockGetStagedFileContent.mockResolvedValue(null);
            mockParseUnifiedDiff.mockReturnValue([makeFileDiff()]);
            await generateCommitMessage();
            // Should pass empty/filtered contexts, not crash
            expect(mockBuildSingleCallContext).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                [] // null content filtered out
            );
        });

        it('passes correct model to runClaude', async () => {
            mockGetSettings.mockReturnValue({
                analysisModel: 'haiku',
                synthesisModel: 'sonnet',
                singleCallModel: 'opus',
                parallelFileThreshold: 4,
                maxConcurrentAgents: 5,
                includeFileContext: true,
            });
            mockParseUnifiedDiff.mockReturnValue([makeFileDiff()]);
            await generateCommitMessage();
            expect(mockRunClaude).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                '/repo',
                expect.anything(),
                { model: 'opus' }
            );
        });
    });
});
