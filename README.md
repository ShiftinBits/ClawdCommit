# <img src="images/clawd-icon.png" height="30"> ClawdCommit

[![Snyk Security Monitored](https://img.shields.io/badge/security-monitored-8A2BE2?logo=snyk)](https://snyk.io/test/github/shiftinbits/clawdcommit) [![License](https://img.shields.io/badge/license-MIT-3DA639?logo=opensourceinitiative&logoColor=white)](LICENSE)

A VS Code extension that generates git commit messages using the [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code).

Stage your changes, click the button in the source control panel "Changes" bar, and ClawdCommit will draft a commit message based on your staged diff and recent commit history using Claude Code CLI.

<img src="images/screenshot.png" height="200">

## Installation

1. Visit the [ClawdCommit listing in the Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=ShiftinBits.clawdcommit)
2. Click on "Install" button
3. Proceed with the extension installation process

## Prerequisites

- [VS Code](https://code.visualstudio.com/) 1.85+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and available on your `PATH`
- A git repository open in VS Code

## Running locally

1. Clone the repo and install dependencies:

   ```sh
   git clone <repo-url>
   cd ClawdCommit
   npm install
   ```

2. Open the project in VS Code.

3. Press **F5** (or **Run > Start Debugging**). This launches a new Extension Development Host window with the extension loaded.

4. In the Extension Development Host, open a git repository, stage some changes, and click the ClawdCommit icon in the Source Control title bar.

### Development build

```sh
npm run compile
```

This type-checks with `tsc` then bundles with esbuild into `dist/extension.js`.

### Packaging as a `.vsix`

```sh
npx @vscode/vsce package
```

This produces a `.vsix` file you can install in VS Code via **Extensions > Install from VSIX...**.

## License

MIT
