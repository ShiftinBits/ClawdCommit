import { getSettings } from '../settings';
import * as vscode from 'vscode';

describe('getSettings', () => {
    it('returns correct default values for all fields', () => {
        const settings = getSettings();

        expect(settings).toEqual({
            model: 'sonnet',
            includeFileContext: true,
        });
    });

    it('returns custom values when configuration is overridden', () => {
        const customValues: Record<string, unknown> = {
            model: 'opus',
            includeFileContext: false,
        };

        const mockGetConfig = vscode.workspace.getConfiguration as jest.Mock;
        mockGetConfig.mockReturnValue({
            get: jest.fn((key: string, defaultValue: unknown) => customValues[key] ?? defaultValue),
        });

        const settings = getSettings();

        expect(settings).toEqual({
            model: 'opus',
            includeFileContext: false,
        });
    });

    it('calls vscode.workspace.getConfiguration with "clawdCommit"', () => {
        getSettings();
        expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('clawdCommit');
    });

    it('calls config.get with each property name and its default value', () => {
        const mockGet = jest.fn((_key: string, defaultValue: unknown) => defaultValue);
        const mockGetConfig = vscode.workspace.getConfiguration as jest.Mock;
        mockGetConfig.mockReturnValue({ get: mockGet });

        getSettings();

        expect(mockGet).toHaveBeenCalledWith('model', 'sonnet');
        expect(mockGet).toHaveBeenCalledWith('includeFileContext', true);
    });
});
