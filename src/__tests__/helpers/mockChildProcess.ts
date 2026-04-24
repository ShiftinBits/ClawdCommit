import { EventEmitter } from 'events';

export interface MockStdin extends EventEmitter {
    write: jest.Mock;
    end: jest.Mock;
}

export interface MockChildProcess extends EventEmitter {
    stdin: MockStdin;
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: jest.Mock;
    emitStdout: (data: string) => void;
    emitStderr: (data: string) => void;
    emitClose: (code: number | null) => void;
    emitError: (err: NodeJS.ErrnoException) => void;
    emitStdinError: (err: Error) => void;
}

function createMockStdin(): MockStdin {
    const stdin = new EventEmitter() as MockStdin;
    stdin.write = jest.fn();
    stdin.end = jest.fn();
    return stdin;
}

export function createMockChildProcess(): MockChildProcess {
    const proc = new EventEmitter() as MockChildProcess;
    proc.stdin = createMockStdin();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = jest.fn();

    proc.emitStdout = (data: string) => proc.stdout.emit('data', Buffer.from(data));
    proc.emitStderr = (data: string) => proc.stderr.emit('data', Buffer.from(data));
    proc.emitClose = (code: number | null) => proc.emit('close', code);
    proc.emitError = (err: NodeJS.ErrnoException) => proc.emit('error', err);
    proc.emitStdinError = (err: Error) => proc.stdin.emit('error', err);

    return proc;
}
