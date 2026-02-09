export interface MockCancellationToken {
    isCancellationRequested: boolean;
    onCancellationRequested: jest.Mock;
    cancel: () => void;
}

export function createMockCancellationToken(): MockCancellationToken {
    const listeners: Array<() => void> = [];
    const token: MockCancellationToken = {
        isCancellationRequested: false,
        onCancellationRequested: jest.fn((listener: () => void) => {
            listeners.push(listener);
            return { dispose: jest.fn() };
        }),
        cancel() {
            token.isCancellationRequested = true;
            listeners.forEach((fn) => fn());
        },
    };
    return token;
}
