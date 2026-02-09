jest.mock('child_process');

import { spawn } from 'child_process';
import { runClaude } from '../claude';
import * as vscode from 'vscode';
import { createMockChildProcess, type MockChildProcess } from './helpers/mockChildProcess';
import { createMockCancellationToken } from './helpers/mockCancellationToken';

const mockSpawn = spawn as unknown as jest.MockedFunction<typeof spawn>;
let mockProcess: MockChildProcess;

beforeEach(() => {
    mockProcess = createMockChildProcess();
    mockSpawn.mockReturnValue(mockProcess as any);
});

describe('runClaude', () => {
    describe('success paths', () => {
        it('returns accumulated stdout on close(0)', async () => {
            const token = createMockCancellationToken();

            const promise = runClaude('instruction', 'context', '/cwd', token);
            mockProcess.emitStdout('commit message');
            mockProcess.emitClose(0);

            const result = await promise;

            expect(result).toBe('commit message');
        });

        it('writes context to stdin and calls stdin.end()', async () => {
            const token = createMockCancellationToken();

            const promise = runClaude('instruction', 'my context', '/cwd', token);
            mockProcess.emitClose(0);
            await promise;

            expect(mockProcess.stdin.write).toHaveBeenCalledWith('my context');
            expect(mockProcess.stdin.end).toHaveBeenCalled();
        });

        it('accumulates multi-chunk stdout', async () => {
            const token = createMockCancellationToken();

            const promise = runClaude('instruction', 'context', '/cwd', token);
            mockProcess.emitStdout('hello ');
            mockProcess.emitStdout('world');
            mockProcess.emitClose(0);

            const result = await promise;

            expect(result).toBe('hello world');
        });
    });

    describe('arguments', () => {
        it('passes correct args to spawn', async () => {
            const token = createMockCancellationToken();

            const promise = runClaude('my instruction', 'ctx', '/my/cwd', token);
            mockProcess.emitClose(0);
            await promise;

            expect(mockSpawn).toHaveBeenCalledWith(
                'claude',
                ['-p', 'my instruction', '--model', 'sonnet'],
                expect.objectContaining({
                    cwd: '/my/cwd',
                    stdio: ['pipe', 'pipe', 'pipe'],
                    env: expect.any(Object),
                })
            );
        });

        it('default model is sonnet when no options', async () => {
            const token = createMockCancellationToken();

            const promise = runClaude('inst', 'ctx', '/cwd', token);
            mockProcess.emitClose(0);
            await promise;

            expect(mockSpawn).toHaveBeenCalledWith(
                'claude',
                expect.arrayContaining(['--model', 'sonnet']),
                expect.any(Object)
            );
        });

        it('uses custom model from options.model', async () => {
            const token = createMockCancellationToken();

            const promise = runClaude('inst', 'ctx', '/cwd', token, { model: 'opus' });
            mockProcess.emitClose(0);
            await promise;

            expect(mockSpawn).toHaveBeenCalledWith(
                'claude',
                ['-p', 'inst', '--model', 'opus'],
                expect.any(Object)
            );
        });
    });

    describe('errors (silent=false)', () => {
        it('shows error toast on non-zero exit code with stderr content', async () => {
            const token = createMockCancellationToken();

            const promise = runClaude('inst', 'ctx', '/cwd', token);
            mockProcess.emitStderr('something went wrong');
            mockProcess.emitClose(1);

            const result = await promise;

            expect(result).toBeUndefined();
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'ClawdCommit: something went wrong'
            );
        });

        it('shows generic message when stderr is empty', async () => {
            const token = createMockCancellationToken();

            const promise = runClaude('inst', 'ctx', '/cwd', token);
            mockProcess.emitClose(1);

            const result = await promise;

            expect(result).toBeUndefined();
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'ClawdCommit: Process exited with code 1'
            );
        });
    });

    describe('errors (silent=true)', () => {
        it('suppresses toast on non-zero exit', async () => {
            const token = createMockCancellationToken();

            const promise = runClaude('inst', 'ctx', '/cwd', token, { silent: true });
            mockProcess.emitStderr('error output');
            mockProcess.emitClose(1);

            const result = await promise;

            expect(result).toBeUndefined();
            expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
        });

        it('suppresses toast on non-ENOENT error', async () => {
            const token = createMockCancellationToken();

            const promise = runClaude('inst', 'ctx', '/cwd', token, { silent: true });
            const err = new Error('spawn failed') as NodeJS.ErrnoException;
            err.code = 'EPERM';
            mockProcess.emitError(err);

            const result = await promise;

            expect(result).toBeUndefined();
            expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
        });
    });

    describe('ENOENT', () => {
        it('shows CLI not found message when error.code is ENOENT', async () => {
            const token = createMockCancellationToken();

            const promise = runClaude('inst', 'ctx', '/cwd', token);
            const err = new Error('spawn claude ENOENT') as NodeJS.ErrnoException;
            err.code = 'ENOENT';
            mockProcess.emitError(err);

            const result = await promise;

            expect(result).toBeUndefined();
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'ClawdCommit: "claude" CLI not found. Install Claude Code and ensure it is in your PATH.'
            );
        });

        it('shows CLI not found even when silent=true', async () => {
            const token = createMockCancellationToken();

            const promise = runClaude('inst', 'ctx', '/cwd', token, { silent: true });
            const err = new Error('spawn claude ENOENT') as NodeJS.ErrnoException;
            err.code = 'ENOENT';
            mockProcess.emitError(err);

            const result = await promise;

            expect(result).toBeUndefined();
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'ClawdCommit: "claude" CLI not found. Install Claude Code and ensure it is in your PATH.'
            );
        });
    });

    describe('cancellation', () => {
        it('returns undefined immediately when token already cancelled', async () => {
            const token = createMockCancellationToken();
            token.isCancellationRequested = true;

            const result = await runClaude('inst', 'ctx', '/cwd', token);

            expect(result).toBeUndefined();
            expect(mockSpawn).not.toHaveBeenCalled();
        });

        it('kills process with SIGTERM on cancellation and returns undefined', async () => {
            const token = createMockCancellationToken();

            const promise = runClaude('inst', 'ctx', '/cwd', token);
            token.cancel();

            const result = await promise;

            expect(result).toBeUndefined();
            expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
        });

        it('returns undefined when cancelled before close event', async () => {
            const token = createMockCancellationToken();

            const promise = runClaude('inst', 'ctx', '/cwd', token);
            mockProcess.emitStdout('partial output');
            token.cancel();
            mockProcess.emitClose(0);

            const result = await promise;

            expect(result).toBeUndefined();
        });
    });

    describe('cleanup', () => {
        it('disposes cancel listener on close', async () => {
            const token = createMockCancellationToken();

            const promise = runClaude('inst', 'ctx', '/cwd', token);
            mockProcess.emitClose(0);
            await promise;

            const disposable = token.onCancellationRequested.mock.results[0].value;
            expect(disposable.dispose).toHaveBeenCalled();
        });
    });
});
