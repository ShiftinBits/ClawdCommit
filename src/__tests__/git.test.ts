import { getGitRepository, formatCommitLog } from '../git';
import * as vscode from 'vscode';

describe('getGitRepository', () => {
    it('returns null and shows error when git extension not found', async () => {
        (vscode.extensions.getExtension as jest.Mock).mockReturnValue(undefined);

        const result = await getGitRepository();

        expect(result).toBeNull();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Git extension not found.'
        );
    });

    it('activates the git extension if it is not active and proceeds', async () => {
        const mockRepo = { rootUri: { fsPath: '/repo' }, inputBox: { value: '' } };
        const activateMock = jest.fn().mockResolvedValue(undefined);
        const mockExtension = {
            isActive: false,
            activate: activateMock,
            exports: { getAPI: () => ({ repositories: [mockRepo] }) },
        };

        activateMock.mockImplementation(async () => {
            mockExtension.isActive = true;
        });

        (vscode.extensions.getExtension as jest.Mock).mockReturnValue(mockExtension);

        const result = await getGitRepository();

        expect(activateMock).toHaveBeenCalled();
        expect(result).toBe(mockRepo);
    });

    it('returns null and shows error when no repositories', async () => {
        (vscode.extensions.getExtension as jest.Mock).mockReturnValue({
            isActive: true,
            exports: { getAPI: () => ({ repositories: [] }) },
        });

        const result = await getGitRepository();

        expect(result).toBeNull();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'No git repository found in workspace.'
        );
    });

    it('returns the single repository when exactly one exists', async () => {
        const mockRepo = { rootUri: { fsPath: '/repo' }, inputBox: { value: '' } };
        (vscode.extensions.getExtension as jest.Mock).mockReturnValue({
            isActive: true,
            exports: { getAPI: () => ({ repositories: [mockRepo] }) },
        });

        const result = await getGitRepository();

        expect(result).toBe(mockRepo);
    });

    it('returns matched repo for active editor URI in multi-root', async () => {
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

        const result = await getGitRepository();

        expect(result).toBe(mockRepo2);
        expect(mockGetRepository).toHaveBeenCalled();
    });

    it('returns first repo when active editor does not match any repository', async () => {
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

        const result = await getGitRepository();

        expect(result).toBe(mockRepo1);
    });

    it('returns first repo when no active editor', async () => {
        const mockRepo1 = { rootUri: { fsPath: '/repo1' }, inputBox: { value: '' } };
        const mockRepo2 = { rootUri: { fsPath: '/repo2' }, inputBox: { value: '' } };
        (vscode.extensions.getExtension as jest.Mock).mockReturnValue({
            isActive: true,
            exports: { getAPI: () => ({ repositories: [mockRepo1, mockRepo2], getRepository: jest.fn() }) },
        });

        vscode.window.activeTextEditor = undefined;

        const result = await getGitRepository();

        expect(result).toBe(mockRepo1);
    });

    it('uses targetUri via api.getRepository when provided (multi-repo)', async () => {
        const mockRepo1 = { rootUri: { fsPath: '/repo1' }, inputBox: { value: '' } };
        const mockRepo2 = { rootUri: { fsPath: '/repo2' }, inputBox: { value: '' } };
        const mockGetRepository = jest.fn().mockReturnValue(mockRepo2);
        (vscode.extensions.getExtension as jest.Mock).mockReturnValue({
            isActive: true,
            exports: { getAPI: () => ({ repositories: [mockRepo1, mockRepo2], getRepository: mockGetRepository }) },
        });

        vscode.window.activeTextEditor = undefined;

        const targetUri = { fsPath: '/repo2' } as unknown as Parameters<typeof getGitRepository>[0];
        const result = await getGitRepository(targetUri);

        expect(mockGetRepository).toHaveBeenCalledWith(targetUri);
        expect(result).toBe(mockRepo2);
    });

    it('falls back to matching targetUri by rootUri when api.getRepository misses', async () => {
        const mockRepo1 = { rootUri: { fsPath: '/repo1' }, inputBox: { value: '' } };
        const mockRepo2 = { rootUri: { fsPath: '/repo2' }, inputBox: { value: '' } };
        const mockGetRepository = jest.fn().mockReturnValue(null);
        (vscode.extensions.getExtension as jest.Mock).mockReturnValue({
            isActive: true,
            exports: { getAPI: () => ({ repositories: [mockRepo1, mockRepo2], getRepository: mockGetRepository }) },
        });

        const targetUri = { fsPath: '/repo2' } as unknown as Parameters<typeof getGitRepository>[0];
        const result = await getGitRepository(targetUri);

        expect(result).toBe(mockRepo2);
    });

    it('ignores targetUri that matches nothing and proceeds with fallbacks', async () => {
        const mockRepo1 = { rootUri: { fsPath: '/repo1' }, inputBox: { value: '' } };
        const mockRepo2 = { rootUri: { fsPath: '/repo2' }, inputBox: { value: '' } };
        const mockGetRepository = jest.fn().mockReturnValue(null);
        (vscode.extensions.getExtension as jest.Mock).mockReturnValue({
            isActive: true,
            exports: { getAPI: () => ({ repositories: [mockRepo1, mockRepo2], getRepository: mockGetRepository }) },
        });

        vscode.window.activeTextEditor = undefined;

        const targetUri = { fsPath: '/unknown' } as unknown as Parameters<typeof getGitRepository>[0];
        const result = await getGitRepository(targetUri);

        expect(result).toBe(mockRepo1);
    });
});

describe('formatCommitLog', () => {
    it('formats commits as short-hash + first line of message', () => {
        const commits = [
            { hash: 'abc1234567890', message: 'fix: correct null check' },
            { hash: 'def5678901234', message: 'feat: add login page' },
        ];

        expect(formatCommitLog(commits)).toBe(
            'abc1234 fix: correct null check\ndef5678 feat: add login page'
        );
    });

    it('uses only the first line of multi-line messages', () => {
        const commits = [
            { hash: 'abc1234567890', message: 'fix: short subject\n\nLong body here' },
        ];

        expect(formatCommitLog(commits)).toBe('abc1234 fix: short subject');
    });

    it('returns empty string for empty array', () => {
        expect(formatCommitLog([])).toBe('');
    });

    it('handles short hashes gracefully', () => {
        const commits = [{ hash: 'abc', message: 'test' }];
        expect(formatCommitLog(commits)).toBe('abc test');
    });
});
