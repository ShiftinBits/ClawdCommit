# ClawdCommit

A VS Code extension that generates git commit messages using the [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code).

Stage your changes, click the button in the Source Control title bar (or run the command), and Claude will draft a commit message based on your staged diff and recent commit history.

## Prerequisites

- [VS Code](https://code.visualstudio.com/) 1.85+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and available on your `PATH`
- A git repository open in VS Code

## Running locally

1. Clone the repo and install dependencies:

   ```sh
   git clone <repo-url>
   cd cc-vscode-src-cntrl
   npm install
   ```

2. Open the project in VS Code.

3. Press **F5** (or **Run > Start Debugging**). This launches a new Extension Development Host window with the extension loaded.

4. In the Extension Development Host, open a git repository, stage some changes, and click the ClawdCommit icon in the Source Control title bar — or run **ClawdCommit: Generate Commit Message with Claude** from the Command Palette (`Cmd+Shift+P`).

### Watch mode

To recompile automatically on file changes while developing:

```sh
npm run watch
```

## Building

### Development build

```sh
npm run compile
```

This type-checks with `tsc` then bundles with esbuild into `dist/extension.js`.

### Production build

```sh
npm run package
```

Same as the development build but with minification enabled and sourcemaps disabled.

### Packaging as a `.vsix`

```sh
npx @vscode/vsce package
```

This produces a `.vsix` file you can install in VS Code via **Extensions > Install from VSIX...**.

## License

MIT
