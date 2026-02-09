import { getSettings } from '../settings';
import * as vscode from 'vscode';

describe('getSettings', () => {
    it('returns correct default values for all fields', () => {
        const settings = getSettings();

        expect(settings).toEqual({
            analysisModel: 'haiku',
            synthesisModel: 'sonnet',
            singleCallModel: 'sonnet',
            parallelFileThreshold: 4,
            maxConcurrentAgents: 5,
            includeFileContext: true,
        });
    });

    it('returns custom values when configuration is overridden', () => {
        const customValues: Record<string, unknown> = {
            analysisModel: 'opus',
            synthesisModel: 'opus',
            singleCallModel: 'haiku',
            parallelFileThreshold: 10,
            maxConcurrentAgents: 2,
            includeFileContext: false,
        };

        const mockGetConfig = vscode.workspace.getConfiguration as jest.Mock;
        mockGetConfig.mockReturnValue({
            get: jest.fn((key: string, defaultValue: unknown) => customValues[key] ?? defaultValue),
        });

        const settings = getSettings();

        expect(settings).toEqual({
            analysisModel: 'opus',
            synthesisModel: 'opus',
            singleCallModel: 'haiku',
            parallelFileThreshold: 10,
            maxConcurrentAgents: 2,
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

        expect(mockGet).toHaveBeenCalledWith('analysisModel', 'haiku');
        expect(mockGet).toHaveBeenCalledWith('synthesisModel', 'sonnet');
        expect(mockGet).toHaveBeenCalledWith('singleCallModel', 'sonnet');
        expect(mockGet).toHaveBeenCalledWith('parallelFileThreshold', 4);
        expect(mockGet).toHaveBeenCalledWith('maxConcurrentAgents', 5);
        expect(mockGet).toHaveBeenCalledWith('includeFileContext', true);
    });
});
