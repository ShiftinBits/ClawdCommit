jest.mock('child_process');

import { spawn } from 'child_process';
import { CliProvider } from '../../providers/cliProvider';
import * as vscode from 'vscode';
import { createMockChildProcess, type MockChildProcess } from '../helpers/mockChildProcess';
import { createMockCancellationToken } from '../helpers/mockCancellationToken';

const mockSpawn = spawn as unknown as jest.MockedFunction<typeof spawn>;
let mockProcess: MockChildProcess;

beforeEach(() => {
    mockProcess = createMockChildProcess();
    mockSpawn.mockReturnValue(mockProcess as any);
});

describe('CliProvider', () => {
    describe('success paths', () => {
        it('returns accumulated stdout on close(0)', async () => {
            const provider = new CliProvider('/cwd');
            const token = createMockCancellationToken();

            const promise = provider.generateMessage('instruction', 'context', token);
            mockProcess.emitStdout('commit message');
            mockProcess.emitClose(0);

            const result = await promise;
            expect(result).toBe('commit message');
        });

        it('writes context to stdin via end()', async () => {
            const provider = new CliProvider('/cwd');
            const token = createMockCancellationToken();

            const promise = provider.generateMessage('instruction', 'my context', token);
            mockProcess.emitClose(0);
            await promise;

            expect(mockProcess.stdin.end).toHaveBeenCalledWith('my context');
        });

        it('accumulates multi-chunk stdout', async () => {
            const provider = new CliProvider('/cwd');
            const token = createMockCancellationToken();

            const promise = provider.generateMessage('instruction', 'context', token);
            mockProcess.emitStdout('hello ');
            mockProcess.emitStdout('world');
            mockProcess.emitClose(0);

            const result = await promise;
            expect(result).toBe('hello world');
        });

        it('correctly joins multiple buffer chunks', async () => {
            const provider = new CliProvider('/cwd');
            const token = createMockCancellationToken();

            const promise = provider.generateMessage('instruction', 'context', token);
            mockProcess.emitStdout('chunk1-');
            mockProcess.emitStdout('chunk2-');
            mockProcess.emitStdout('chunk3');
            mockProcess.emitClose(0);

            const result = await promise;
            expect(result).toBe('chunk1-chunk2-chunk3');
        });
    });

    describe('arguments', () => {
        it('passes correct args to spawn', async () => {
            const provider = new CliProvider('/my/cwd');
            const token = createMockCancellationToken();

            const promise = provider.generateMessage('my instruction', 'ctx', token);
            mockProcess.emitClose(0);
            await promise;

            expect(mockSpawn).toHaveBeenCalledWith(
                'claude',
                ['-p', 'my instruction', '--model', 'sonnet'],
                {
                    cwd: '/my/cwd',
                    stdio: ['pipe', 'pipe', 'pipe'],
                }
            );
        });

        it('default model is sonnet when no options', async () => {
            const provider = new CliProvider('/cwd');
            const token = createMockCancellationToken();

            const promise = provider.generateMessage('inst', 'ctx', token);
            mockProcess.emitClose(0);
            await promise;

            expect(mockSpawn).toHaveBeenCalledWith(
                'claude',
                expect.arrayContaining(['--model', 'sonnet']),
                expect.any(Object)
            );
        });

        it('uses custom model from options.model', async () => {
            const provider = new CliProvider('/cwd');
            const token = createMockCancellationToken();

            const promise = provider.generateMessage('inst', 'ctx', token, { model: 'opus' });
            mockProcess.emitClose(0);
            await promise;

            expect(mockSpawn).toHaveBeenCalledWith(
                'claude',
                ['-p', 'inst', '--model', 'opus'],
                expect.any(Object)
            );
        });
    });

    describe('errors', () => {
        it('shows error toast on non-zero exit code with stderr content', async () => {
            const provider = new CliProvider('/cwd');
            const token = createMockCancellationToken();

            const promise = provider.generateMessage('inst', 'ctx', token);
            mockProcess.emitStderr('something went wrong');
            mockProcess.emitClose(1);

            const result = await promise;
            expect(result).toBeUndefined();
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'something went wrong'
            );
        });

        it('shows generic message when stderr is empty', async () => {
            const provider = new CliProvider('/cwd');
            const token = createMockCancellationToken();

            const promise = provider.generateMessage('inst', 'ctx', token);
            mockProcess.emitClose(1);

            const result = await promise;
            expect(result).toBeUndefined();
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Process exited with code 1'
            );
        });
    });

    describe('ENOENT', () => {
        it('shows CLI not found message when error.code is ENOENT', async () => {
            const provider = new CliProvider('/cwd');
            const token = createMockCancellationToken();

            const promise = provider.generateMessage('inst', 'ctx', token);
            const err = new Error('spawn claude ENOENT') as NodeJS.ErrnoException;
            err.code = 'ENOENT';
            mockProcess.emitError(err);

            const result = await promise;
            expect(result).toBeUndefined();
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                '"claude" CLI not found. Install Claude Code and ensure it is in your PATH.'
            );
        });

        it('shows generic error for non-ENOENT errors', async () => {
            const provider = new CliProvider('/cwd');
            const token = createMockCancellationToken();

            const promise = provider.generateMessage('inst', 'ctx', token);
            const err = new Error('spawn failed') as NodeJS.ErrnoException;
            err.code = 'EPERM';
            mockProcess.emitError(err);

            const result = await promise;
            expect(result).toBeUndefined();
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Failed to start Claude CLI: spawn failed'
            );
        });
    });

    describe('cancellation', () => {
        it('returns undefined immediately when token already cancelled', async () => {
            const provider = new CliProvider('/cwd');
            const token = createMockCancellationToken();
            token.isCancellationRequested = true;

            const result = await provider.generateMessage('inst', 'ctx', token);
            expect(result).toBeUndefined();
            expect(mockSpawn).not.toHaveBeenCalled();
        });

        it('kills process with SIGTERM on cancellation and returns undefined', async () => {
            const provider = new CliProvider('/cwd');
            const token = createMockCancellationToken();

            const promise = provider.generateMessage('inst', 'ctx', token);
            token.cancel();

            const result = await promise;
            expect(result).toBeUndefined();
            expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
        });

        it('returns undefined when cancelled before close event', async () => {
            const provider = new CliProvider('/cwd');
            const token = createMockCancellationToken();

            const promise = provider.generateMessage('inst', 'ctx', token);
            mockProcess.emitStdout('partial output');
            token.cancel();
            mockProcess.emitClose(0);

            const result = await promise;
            expect(result).toBeUndefined();
        });
    });

    describe('cleanup', () => {
        it('disposes cancel listener on close', async () => {
            const provider = new CliProvider('/cwd');
            const token = createMockCancellationToken();

            const promise = provider.generateMessage('inst', 'ctx', token);
            mockProcess.emitClose(0);
            await promise;

            const disposable = token.onCancellationRequested.mock.results[0].value;
            expect(disposable.dispose).toHaveBeenCalled();
        });
    });
});
