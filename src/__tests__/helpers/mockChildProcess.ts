import { EventEmitter } from 'events';

export interface MockChildProcess extends EventEmitter {
    stdin: { write: jest.Mock; end: jest.Mock };
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: jest.Mock;
    emitStdout: (data: string) => void;
    emitStderr: (data: string) => void;
    emitClose: (code: number | null) => void;
    emitError: (err: NodeJS.ErrnoException) => void;
}

export function createMockChildProcess(): MockChildProcess {
    const proc = new EventEmitter() as MockChildProcess;
    proc.stdin = { write: jest.fn(), end: jest.fn() };
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = jest.fn();

    proc.emitStdout = (data: string) => proc.stdout.emit('data', Buffer.from(data));
    proc.emitStderr = (data: string) => proc.stderr.emit('data', Buffer.from(data));
    proc.emitClose = (code: number | null) => proc.emit('close', code);
    proc.emitError = (err: NodeJS.ErrnoException) => proc.emit('error', err);

    return proc;
}
