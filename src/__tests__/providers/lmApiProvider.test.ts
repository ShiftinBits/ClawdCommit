import * as vscode from 'vscode';
import { LmApiProvider } from '../../providers/lmApiProvider';
import { createMockCancellationToken } from '../helpers/mockCancellationToken';

const mockSelectChatModels = vscode.lm.selectChatModels as jest.Mock;

function createMockModel(overrides?: Partial<{ sendRequest: jest.Mock }>) {
    return {
        sendRequest: overrides?.sendRequest ?? jest.fn().mockResolvedValue({
            text: (async function* () {
                yield 'fix: ';
                yield 'correct null check';
            })(),
        }),
    };
}

beforeEach(() => {
    mockSelectChatModels.mockReset();
});

describe('LmApiProvider', () => {
    describe('success paths', () => {
        it('returns collected streaming response', async () => {
            const model = createMockModel();
            mockSelectChatModels.mockResolvedValue([model]);

            const provider = new LmApiProvider();
            const token = createMockCancellationToken();

            const result = await provider.generateMessage('instruction', 'context', token);
            expect(result).toBe('fix: correct null check');
        });

        it('sends instruction and context as a single User message', async () => {
            const model = createMockModel();
            mockSelectChatModels.mockResolvedValue([model]);

            const provider = new LmApiProvider();
            const token = createMockCancellationToken();

            await provider.generateMessage('my instruction', 'my context', token);

            expect(model.sendRequest).toHaveBeenCalledWith(
                [expect.objectContaining({ role: 'user', content: 'my instruction\n\nmy context' })],
                {},
                token
            );
        });
    });

    describe('model selection', () => {
        it('selects model by vendor and family when model option provided', async () => {
            const model = createMockModel();
            mockSelectChatModels.mockResolvedValueOnce([model]);

            const provider = new LmApiProvider();
            const token = createMockCancellationToken();

            await provider.generateMessage('inst', 'ctx', token, { model: 'sonnet' });

            expect(mockSelectChatModels).toHaveBeenCalledWith({
                vendor: 'anthropic',
                family: 'claude-sonnet',
            });
        });

        it('falls back to any Anthropic model when exact family not found', async () => {
            const model = createMockModel();
            mockSelectChatModels.mockResolvedValueOnce([]);
            mockSelectChatModels.mockResolvedValueOnce([model]);

            const provider = new LmApiProvider();
            const token = createMockCancellationToken();

            await provider.generateMessage('inst', 'ctx', token, { model: 'sonnet' });

            expect(mockSelectChatModels).toHaveBeenCalledWith({ vendor: 'anthropic' });
        });

        it('falls back to family-only match without vendor filter', async () => {
            const model = createMockModel();
            mockSelectChatModels.mockResolvedValueOnce([]);
            mockSelectChatModels.mockResolvedValueOnce([]);
            mockSelectChatModels.mockResolvedValueOnce([model]);

            const provider = new LmApiProvider();
            const token = createMockCancellationToken();

            await provider.generateMessage('inst', 'ctx', token, { model: 'opus' });

            expect(mockSelectChatModels).toHaveBeenCalledWith({ family: 'claude-opus' });
        });

        it('shows error when no Claude model is available', async () => {
            mockSelectChatModels.mockResolvedValue([]);

            const provider = new LmApiProvider();
            const token = createMockCancellationToken();

            const result = await provider.generateMessage('inst', 'ctx', token, { model: 'sonnet' });

            expect(result).toBeUndefined();
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('No Claude model found')
            );
        });

        it('queries any Anthropic model when no model option provided', async () => {
            const model = createMockModel();
            mockSelectChatModels.mockResolvedValueOnce([model]);

            const provider = new LmApiProvider();
            const token = createMockCancellationToken();

            await provider.generateMessage('inst', 'ctx', token);

            expect(mockSelectChatModels).toHaveBeenCalledWith({ vendor: 'anthropic' });
        });
    });

    describe('error handling', () => {
        it('catches LanguageModelError and shows error message', async () => {
            const model = createMockModel({
                sendRequest: jest.fn().mockRejectedValue(
                    new vscode.LanguageModelError('rate limited')
                ),
            });
            mockSelectChatModels.mockResolvedValue([model]);

            const provider = new LmApiProvider();
            const token = createMockCancellationToken();

            const result = await provider.generateMessage('inst', 'ctx', token);

            expect(result).toBeUndefined();
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Claude request failed: rate limited'
            );
        });

        it('shows generic error for non-LanguageModelError exceptions', async () => {
            const model = createMockModel({
                sendRequest: jest.fn().mockRejectedValue(new Error('network error')),
            });
            mockSelectChatModels.mockResolvedValue([model]);

            const provider = new LmApiProvider();
            const token = createMockCancellationToken();

            const result = await provider.generateMessage('inst', 'ctx', token);
            expect(result).toBeUndefined();
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Unexpected error: network error'
            );
        });
    });

    describe('cancellation', () => {
        it('returns undefined when cancelled during streaming', async () => {
            const token = createMockCancellationToken();
            const model = createMockModel({
                sendRequest: jest.fn().mockResolvedValue({
                    text: (async function* () {
                        yield 'partial';
                        token.isCancellationRequested = true;
                        yield ' more';
                    })(),
                }),
            });
            mockSelectChatModels.mockResolvedValue([model]);

            const provider = new LmApiProvider();
            const result = await provider.generateMessage('inst', 'ctx', token);

            expect(result).toBeUndefined();
        });
    });
});
