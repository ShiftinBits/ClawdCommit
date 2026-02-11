jest.mock('../git');
jest.mock('../claude');
jest.mock('../settings');
jest.mock('../prompts');

import * as vscode from 'vscode';
import { generateCommitMessage } from '../generateCommitMessage';
import { getGitRepository, getStagedDiff, getRecentCommitLog } from '../git';
import { runClaude } from '../claude';
import { getSettings } from '../settings';
import { buildInstruction, buildContext } from '../prompts';
import { createMockCancellationToken } from './helpers/mockCancellationToken';

const mockGetGitRepository = getGitRepository as jest.MockedFunction<typeof getGitRepository>;
const mockGetStagedDiff = getStagedDiff as jest.MockedFunction<typeof getStagedDiff>;
const mockGetRecentCommitLog = getRecentCommitLog as jest.MockedFunction<typeof getRecentCommitLog>;
const mockRunClaude = runClaude as jest.MockedFunction<typeof runClaude>;
const mockGetSettings = getSettings as jest.MockedFunction<typeof getSettings>;
const mockBuildInstruction = buildInstruction as jest.MockedFunction<typeof buildInstruction>;
const mockBuildContext = buildContext as jest.MockedFunction<typeof buildContext>;
const mockWithProgress = vscode.window.withProgress as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let mockRepo: { rootUri: { fsPath: string }; inputBox: { value: string } };

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    mockRepo = { rootUri: { fsPath: '/repo' }, inputBox: { value: '' } };

    mockGetGitRepository.mockReturnValue(mockRepo as any);
    mockGetStagedDiff.mockResolvedValue('diff --git a/f.ts b/f.ts\n+line');
    mockGetRecentCommitLog.mockResolvedValue('abc123 previous commit');
    mockGetSettings.mockReturnValue({
        model: 'sonnet',
        includeFileContext: true,
    });
    mockRunClaude.mockResolvedValue('fix: correct null check');
    mockBuildInstruction.mockReturnValue('instruction');
    mockBuildContext.mockReturnValue('context');

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

    describe('error resilience', () => {
        it('ignores getRecentCommitLog failure', async () => {
            mockGetRecentCommitLog.mockRejectedValue(new Error('no commits'));
            await generateCommitMessage();
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

    describe('commit generation', () => {
        it('passes includeFileContext to buildInstruction', async () => {
            await generateCommitMessage();
            expect(mockBuildInstruction).toHaveBeenCalledWith(true);
        });

        it('passes includeFileContext=false to buildInstruction when disabled', async () => {
            mockGetSettings.mockReturnValue({
                model: 'sonnet',
                includeFileContext: false,
            });
            await generateCommitMessage();
            expect(mockBuildInstruction).toHaveBeenCalledWith(false);
        });

        it('passes correct model to runClaude', async () => {
            mockGetSettings.mockReturnValue({
                model: 'opus',
                includeFileContext: true,
            });
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
