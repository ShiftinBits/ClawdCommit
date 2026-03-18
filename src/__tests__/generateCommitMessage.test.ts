jest.mock('../git');
jest.mock('../settings');
jest.mock('../prompts');

import * as vscode from 'vscode';
import { generateCommitMessage } from '../generateCommitMessage';
import { getGitRepository, formatCommitLog } from '../git';
import { getSettings } from '../settings';
import { buildInstruction, buildContext } from '../prompts';
import { createMockCancellationToken } from './helpers/mockCancellationToken';
import type { ProviderFactory, CommitMessageProvider } from '../providers/types';

const mockGetGitRepository = getGitRepository as jest.MockedFunction<typeof getGitRepository>;
const mockFormatCommitLog = formatCommitLog as jest.MockedFunction<typeof formatCommitLog>;
const mockGetSettings = getSettings as jest.MockedFunction<typeof getSettings>;
const mockBuildInstruction = buildInstruction as jest.MockedFunction<typeof buildInstruction>;
const mockBuildContext = buildContext as jest.MockedFunction<typeof buildContext>;
const mockWithProgress = vscode.window.withProgress as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let mockDiff: jest.Mock;
let mockLog: jest.Mock;
let mockRepo: {
    rootUri: { fsPath: string };
    inputBox: { value: string };
    state: { indexChanges: unknown[] };
    diff: jest.Mock;
    log: jest.Mock;
};

let mockGenerateMessage: jest.Mock;
let mockProviderFactory: jest.Mock;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    mockDiff = jest.fn().mockResolvedValue('diff --git a/f.ts b/f.ts\n+line');
    mockLog = jest.fn().mockResolvedValue([
        { hash: 'abc1234567890', message: 'previous commit' },
    ]);
    mockRepo = {
        rootUri: { fsPath: '/repo' },
        inputBox: { value: '' },
        state: { indexChanges: [] },
        diff: mockDiff,
        log: mockLog,
    };

    mockGetGitRepository.mockReturnValue(mockRepo as any);
    mockFormatCommitLog.mockReturnValue('abc1234 previous commit');
    mockGetSettings.mockReturnValue({
        model: 'sonnet',
        includeFileContext: true,
    });
    mockBuildInstruction.mockReturnValue('instruction');
    mockBuildContext.mockReturnValue('context');

    mockGenerateMessage = jest.fn().mockResolvedValue('fix: correct null check');
    mockProviderFactory = jest.fn().mockReturnValue({
        generateMessage: mockGenerateMessage,
    } as CommitMessageProvider);

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
            await generateCommitMessage(mockProviderFactory);
            expect(mockDiff).not.toHaveBeenCalled();
        });

        it('shows error and returns when diff rejects', async () => {
            mockDiff.mockRejectedValue(new Error('fatal: not a git repo'));
            await generateCommitMessage(mockProviderFactory);
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('fatal: not a git repo')
            );
            expect(mockRepo.inputBox.value).toBe('');
        });

        it('shows warning when diff is empty', async () => {
            mockDiff.mockResolvedValue('');
            await generateCommitMessage(mockProviderFactory);
            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                expect.stringContaining('No staged changes')
            );
        });

        it('shows warning when diff is whitespace only', async () => {
            mockDiff.mockResolvedValue('  \n  ');
            await generateCommitMessage(mockProviderFactory);
            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                expect.stringContaining('No staged changes')
            );
        });
    });

    describe('VSCode git API usage', () => {
        it('calls repo.diff(true) to get the staged diff', async () => {
            await generateCommitMessage(mockProviderFactory);
            expect(mockDiff).toHaveBeenCalledWith(true);
        });

        it('calls repo.log({ maxEntries: 5 }) for recent commits', async () => {
            await generateCommitMessage(mockProviderFactory);
            expect(mockLog).toHaveBeenCalledWith({ maxEntries: 5 });
        });

        it('formats commit log via formatCommitLog', async () => {
            await generateCommitMessage(mockProviderFactory);
            expect(mockFormatCommitLog).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ hash: 'abc1234567890' }),
                ])
            );
        });
    });

    describe('provider factory', () => {
        it('creates provider with repoRoot', async () => {
            await generateCommitMessage(mockProviderFactory);
            expect(mockProviderFactory).toHaveBeenCalledWith('/repo');
        });

        it('passes instruction, context, token, and model to provider', async () => {
            await generateCommitMessage(mockProviderFactory);
            expect(mockGenerateMessage).toHaveBeenCalledWith(
                'instruction',
                'context',
                expect.objectContaining({ isCancellationRequested: false }),
                { model: 'sonnet' }
            );
        });

        it('passes correct model to provider', async () => {
            mockGetSettings.mockReturnValue({
                model: 'opus',
                includeFileContext: true,
            });
            await generateCommitMessage(mockProviderFactory);
            expect(mockGenerateMessage).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                expect.anything(),
                { model: 'opus' }
            );
        });
    });

    describe('error resilience', () => {
        it('ignores repo.log failure', async () => {
            mockLog.mockRejectedValue(new Error('no commits'));
            await generateCommitMessage(mockProviderFactory);
            expect(mockGenerateMessage).toHaveBeenCalled();
            expect(mockRepo.inputBox.value).toBe('fix: correct null check');
        });
    });

    describe('output handling', () => {
        it('sets inputBox.value on successful generation', async () => {
            await generateCommitMessage(mockProviderFactory);
            expect(mockRepo.inputBox.value).toBe('fix: correct null check');
        });

        it('strips code fences from result', async () => {
            mockGenerateMessage.mockResolvedValue('```\nfix: correct null check\n```');
            await generateCommitMessage(mockProviderFactory);
            expect(mockRepo.inputBox.value).toBe('fix: correct null check');
        });

        it('strips code fences with language tag', async () => {
            mockGenerateMessage.mockResolvedValue('```text\nfix: correct null check\n```');
            await generateCommitMessage(mockProviderFactory);
            expect(mockRepo.inputBox.value).toBe('fix: correct null check');
        });

        it('shows warning on empty response', async () => {
            mockGenerateMessage.mockResolvedValue('   ');
            await generateCommitMessage(mockProviderFactory);
            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                expect.stringContaining('empty response')
            );
            expect(mockRepo.inputBox.value).toBe('');
        });

        it('does not set inputBox when result is undefined', async () => {
            mockGenerateMessage.mockResolvedValue(undefined);
            await generateCommitMessage(mockProviderFactory);
            expect(mockRepo.inputBox.value).toBe('');
        });

        it('strips code fences with CRLF line endings', async () => {
            mockGenerateMessage.mockResolvedValue('```\r\nfix: correct null check\r\n```');
            await generateCommitMessage(mockProviderFactory);
            expect(mockRepo.inputBox.value).toBe('fix: correct null check');
        });

        it('strips code fences with trailing whitespace', async () => {
            mockGenerateMessage.mockResolvedValue('```text\nfix: correct null check\n```  ');
            await generateCommitMessage(mockProviderFactory);
            expect(mockRepo.inputBox.value).toBe('fix: correct null check');
        });

        it('strips code fences with non-word language tag', async () => {
            mockGenerateMessage.mockResolvedValue('```commit-msg\nfix: correct null check\n```');
            await generateCommitMessage(mockProviderFactory);
            expect(mockRepo.inputBox.value).toBe('fix: correct null check');
        });
    });

    describe('commit generation', () => {
        it('passes includeFileContext and canReadFiles to buildInstruction', async () => {
            await generateCommitMessage(mockProviderFactory, true);
            expect(mockBuildInstruction).toHaveBeenCalledWith(true, true);
        });

        it('passes canReadFiles=false when specified', async () => {
            await generateCommitMessage(mockProviderFactory, false);
            expect(mockBuildInstruction).toHaveBeenCalledWith(true, false);
        });

        it('passes includeFileContext=false to buildInstruction when disabled', async () => {
            mockGetSettings.mockReturnValue({
                model: 'sonnet',
                includeFileContext: false,
            });
            await generateCommitMessage(mockProviderFactory, true);
            expect(mockBuildInstruction).toHaveBeenCalledWith(false, true);
        });
    });
});
