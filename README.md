# <img src="images/clawd-icon.png" height="30"> ClawdCommit

[![Current Release](https://img.shields.io/github/v/release/shiftinbits/clawdcommit?link=https%3A%2F%2Fmarketplace.visualstudio.com%2Fitems%3FitemName%3DShiftinBits.clawdcommit)](https://marketplace.visualstudio.com/items?itemName=ShiftinBits.clawdcommit) [![Test Results](https://img.shields.io/github/actions/workflow/status/shiftinbits/clawdcommit/test.yml?branch=main&logo=jest&logoColor=white&label=tests)](https://github.com/shiftinbits/clawdcommit/actions/workflows/test.yml?query=branch%3Amain) [![Code Coverage](https://img.shields.io/codecov/c/github/shiftinbits/clawdcommit?logo=codecov&logoColor=white)](https://app.codecov.io/gh/shiftinbits/clawdcommit/) [![Snyk Security Monitored](https://img.shields.io/badge/security-monitored-8A2BE2?logo=snyk)](https://snyk.io/test/github/shiftinbits/clawdcommit) [![License](https://img.shields.io/badge/license-MIT-3DA639?logo=opensourceinitiative&logoColor=white)](LICENSE)

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

## Configuration

All settings are available under **Settings > Extensions > ClawdCommit** or via `clawdCommit.*` in `settings.json`.

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `clawdCommit.model` | `haiku` \| `sonnet` \| `opus` | `sonnet` | Claude model to use for commit message generation. |
| `clawdCommit.includeFileContext` | `boolean` | `true` | Allow Claude to read files in the working directory for additional context beyond the diff. Disable to restrict analysis to the staged diff only. |

### How it works

When you trigger ClawdCommit, it reads your staged diff and recent commit history, optionally fetches the full content of changed files for richer context, and sends everything to Claude in a single request. Claude generates a commit message matching your project's style.

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

MIT — see [LICENSE](./LICENSE).
