const workspace = {
    getConfiguration: jest.fn().mockReturnValue({
        get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue),
    }),
};

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
            const token = {
                isCancellationRequested: false,
                onCancellationRequested: jest.fn(() => ({ dispose: jest.fn() })),
            };
            return task(progress, token);
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

export { workspace, window, commands, extensions, ProgressLocation, Uri };
