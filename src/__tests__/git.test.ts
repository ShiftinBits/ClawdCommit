import { getGitRepository, formatCommitLog } from '../git';
import * as vscode from 'vscode';

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
