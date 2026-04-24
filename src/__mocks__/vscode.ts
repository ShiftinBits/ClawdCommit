const workspace = {
    getConfiguration: jest.fn().mockReturnValue({
        get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue),
    }),
};

function createDefaultProgressToken() {
    const listeners: Array<() => void> = [];
    const token = {
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

const window = {
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    withProgress: jest.fn(
        async (
            _options: unknown,
            task: (
                progress: { report: jest.Mock },
                token: { isCancellationRequested: boolean; onCancellationRequested: jest.Mock }
            ) => Promise<unknown>
        ) => {
            const progress = { report: jest.fn() };
            return task(progress, createDefaultProgressToken());
        }
    ),
    activeTextEditor: undefined as { document: { uri: { fsPath: string } } } | undefined,
};

const commands = {
    registerCommand: jest.fn(),
};

const extensions = {
    getExtension: jest.fn(),
};

const ProgressLocation = {
    Notification: 15,
    SourceControl: 1,
    Window: 10,
};

const Uri = {
    file: (path: string) => ({ fsPath: path, scheme: 'file', path }),
    parse: (str: string) => ({ fsPath: str, scheme: 'file', path: str }),
};

const LanguageModelChatMessage = {
    User: jest.fn((content: string) => ({ role: 'user', content })),
};

class LanguageModelError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'LanguageModelError';
    }
}

const lm = {
    selectChatModels: jest.fn().mockResolvedValue([]),
};

export {
    workspace,
    window,
    commands,
    extensions,
    ProgressLocation,
    Uri,
    lm,
    LanguageModelChatMessage,
    LanguageModelError,
};
