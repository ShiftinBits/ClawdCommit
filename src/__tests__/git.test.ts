jest.mock('child_process');

import { execFile } from 'child_process';
import { getGitRepository, getStagedDiff, getRecentCommitLog, getStagedFileContent } from '../git';
import * as vscode from 'vscode';

const mockExecFile = execFile as unknown as jest.MockedFunction<typeof execFile>;

beforeEach(() => {
    mockExecFile.mockImplementation(((_cmd: unknown, _args: unknown, _opts: unknown, callback: unknown) => {
        (callback as Function)(null, 'stdout', '');
        return {} as any;
    }) as any);
});

describe('getGitRepository', () => {
    it('returns null and shows error when git extension not found', () => {
        (vscode.extensions.getExtension as jest.Mock).mockReturnValue(undefined);

        const result = getGitRepository();

        expect(result).toBeNull();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Git extension not found.'
        );
    });

    it('returns null and shows error when git extension is not active', () => {
        (vscode.extensions.getExtension as jest.Mock).mockReturnValue({
            isActive: false,
        });

        const result = getGitRepository();

        expect(result).toBeNull();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Git extension is not active.'
        );
    });

    it('returns null and shows error when no repositories', () => {
        (vscode.extensions.getExtension as jest.Mock).mockReturnValue({
            isActive: true,
            exports: { getAPI: () => ({ repositories: [] }) },
        });

        const result = getGitRepository();

        expect(result).toBeNull();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'No git repository found in workspace.'
        );
    });

    it('returns the single repository when exactly one exists', () => {
        const mockRepo = { rootUri: { fsPath: '/repo' }, inputBox: { value: '' } };
        (vscode.extensions.getExtension as jest.Mock).mockReturnValue({
            isActive: true,
            exports: { getAPI: () => ({ repositories: [mockRepo] }) },
        });

        const result = getGitRepository();

        expect(result).toBe(mockRepo);
    });

    it('returns matched repo for active editor URI in multi-root', () => {
        const mockRepo1 = { rootUri: { fsPath: '/repo1' }, inputBox: { value: '' } };
        const mockRepo2 = { rootUri: { fsPath: '/repo2' }, inputBox: { value: '' } };
        const mockGetRepository = jest.fn();
        (vscode.extensions.getExtension as jest.Mock).mockReturnValue({
            isActive: true,
            exports: { getAPI: () => ({ repositories: [mockRepo1, mockRepo2], getRepository: mockGetRepository }) },
        });

        vscode.window.activeTextEditor = {
            document: { uri: { fsPath: '/repo2/src/file.ts' } },
        } as typeof vscode.window.activeTextEditor;

        mockGetRepository.mockReturnValue(mockRepo2);

        const result = getGitRepository();

        expect(result).toBe(mockRepo2);
        expect(mockGetRepository).toHaveBeenCalled();
    });

    it('returns first repo when active editor does not match any repository', () => {
        const mockRepo1 = { rootUri: { fsPath: '/repo1' }, inputBox: { value: '' } };
        const mockRepo2 = { rootUri: { fsPath: '/repo2' }, inputBox: { value: '' } };
        const mockGetRepository = jest.fn();
        (vscode.extensions.getExtension as jest.Mock).mockReturnValue({
            isActive: true,
            exports: { getAPI: () => ({ repositories: [mockRepo1, mockRepo2], getRepository: mockGetRepository }) },
        });

        vscode.window.activeTextEditor = {
            document: { uri: { fsPath: '/other/file.ts' } },
        } as typeof vscode.window.activeTextEditor;

        mockGetRepository.mockReturnValue(null);

        const result = getGitRepository();

        expect(result).toBe(mockRepo1);
    });

    it('returns first repo when no active editor', () => {
        const mockRepo1 = { rootUri: { fsPath: '/repo1' }, inputBox: { value: '' } };
        const mockRepo2 = { rootUri: { fsPath: '/repo2' }, inputBox: { value: '' } };
        (vscode.extensions.getExtension as jest.Mock).mockReturnValue({
            isActive: true,
            exports: { getAPI: () => ({ repositories: [mockRepo1, mockRepo2], getRepository: jest.fn() }) },
        });

        vscode.window.activeTextEditor = undefined;

        const result = getGitRepository();

        expect(result).toBe(mockRepo1);
    });
});

describe('getStagedDiff', () => {
    it('resolves with stdout on success', async () => {
        mockExecFile.mockImplementation(((_cmd: unknown, _args: unknown, _opts: unknown, callback: unknown) => {
            (callback as Function)(null, 'diff output', '');
            return {} as any;
        }) as any);

        const result = await getStagedDiff('/repo');

        expect(result).toBe('diff output');
    });

    it('rejects with stderr message on error', async () => {
        mockExecFile.mockImplementation(((_cmd: unknown, _args: unknown, _opts: unknown, callback: unknown) => {
            (callback as Function)(new Error('fail'), '', 'git error message');
            return {} as any;
        }) as any);

        await expect(getStagedDiff('/repo')).rejects.toThrow('git error message');
    });

    it('passes correct args', async () => {
        await getStagedDiff('/repo');

        expect(mockExecFile).toHaveBeenCalledWith(
            'git',
            ['diff', '--staged'],
            expect.objectContaining({ cwd: '/repo' }),
            expect.any(Function)
        );
    });

    it('uses 10MB maxBuffer', async () => {
        await getStagedDiff('/repo');

        expect(mockExecFile).toHaveBeenCalledWith(
            'git',
            ['diff', '--staged'],
            expect.objectContaining({ maxBuffer: 10 * 1024 * 1024 }),
            expect.any(Function)
        );
    });

    it('passes AbortSignal to execFile when provided', async () => {
        const controller = new AbortController();
        await getStagedDiff('/repo', controller.signal);

        expect(mockExecFile).toHaveBeenCalledWith(
            'git',
            ['diff', '--staged'],
            expect.objectContaining({ signal: controller.signal }),
            expect.any(Function)
        );
    });
});

describe('getRecentCommitLog', () => {
    it('resolves with stdout on success', async () => {
        mockExecFile.mockImplementation(((_cmd: unknown, _args: unknown, _opts: unknown, callback: unknown) => {
            (callback as Function)(null, 'log output', '');
            return {} as any;
        }) as any);

        const result = await getRecentCommitLog('/repo', 5);

        expect(result).toBe('log output');
    });

    it('passes correct args including count', async () => {
        await getRecentCommitLog('/repo', 5);

        expect(mockExecFile).toHaveBeenCalledWith(
            'git',
            ['log', '--oneline', '-5'],
            expect.objectContaining({ cwd: '/repo' }),
            expect.any(Function)
        );
    });
});

describe('getStagedFileContent', () => {
    it('resolves with file content on success', async () => {
        mockExecFile.mockImplementation(((_cmd: unknown, _args: unknown, _opts: unknown, callback: unknown) => {
            (callback as Function)(null, 'file content here', '');
            return {} as any;
        }) as any);

        const result = await getStagedFileContent('path/to/file', '/repo');

        expect(result).toBe('file content here');
    });

    it('resolves with null on error', async () => {
        mockExecFile.mockImplementation(((_cmd: unknown, _args: unknown, _opts: unknown, callback: unknown) => {
            (callback as Function)(new Error('not found'), '', '');
            return {} as any;
        }) as any);

        const result = await getStagedFileContent('path/to/file', '/repo');

        expect(result).toBeNull();
    });

    it('passes correct args', async () => {
        await getStagedFileContent('path/to/file', '/repo');

        expect(mockExecFile).toHaveBeenCalledWith(
            'git',
            ['show', ':path/to/file'],
            expect.objectContaining({ cwd: '/repo' }),
            expect.any(Function)
        );
    });

    it('uses 512KB maxBuffer', async () => {
        await getStagedFileContent('path/to/file', '/repo');

        expect(mockExecFile).toHaveBeenCalledWith(
            'git',
            ['show', ':path/to/file'],
            expect.objectContaining({ maxBuffer: 512 * 1024 }),
            expect.any(Function)
        );
    });

    it('passes AbortSignal to execFile when provided', async () => {
        const controller = new AbortController();
        await getStagedFileContent('path/to/file', '/repo', controller.signal);

        expect(mockExecFile).toHaveBeenCalledWith(
            'git',
            ['show', ':path/to/file'],
            expect.objectContaining({ signal: controller.signal }),
            expect.any(Function)
        );
    });

    it('resolves null when aborted', async () => {
        mockExecFile.mockImplementation(((_cmd: unknown, _args: unknown, _opts: unknown, callback: unknown) => {
            const err = new Error('aborted') as NodeJS.ErrnoException;
            err.code = 'ABORT_ERR';
            (callback as Function)(err, '', '');
            return {} as any;
        }) as any);

        const controller = new AbortController();
        const result = await getStagedFileContent('path/to/file', '/repo', controller.signal);
        expect(result).toBeNull();
    });
});
