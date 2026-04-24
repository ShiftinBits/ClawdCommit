# Changelog

All notable changes to ClawdCommit will be documented in this file.

## [1.2.0]

### Added

- Focused system prompt for the Claude CLI that keeps output to a bare commit message.
- Warn when the configured Claude model is unavailable and a different family is used instead.
- Declare workspace-trust and virtual-workspace capabilities so VS Code handles restricted contexts explicitly.

### Changed

- Wrap staged diff and recent commits with explicit begin/end markers to reduce prompt-injection risk.
- Truncate overlong CLI stderr in error notifications.

### Fixed

- Refresh VSCode Git state before reading the staged diff so changes staged via the terminal or Source Control pane are picked up on the first attempt.
- Validate the configured model against the allowed list before invoking the CLI.
- Swallow `EPIPE` errors when writing the diff to the CLI's stdin.
- Always dispose the cancellation listener and clear the timeout on completion, including the timeout path.
- Include `LanguageModelError.code` in error notifications for clearer diagnostics.
- Drop a stray blank line before the recent-commits section in the prompt.

## [1.1.0]

### Added

- Separate desktop and web entry points, with the web build using the VS Code Language Model API.
- 2-minute timeout on the Claude CLI invocation to prevent indefinite hangs.
- Auto-activate the built-in Git extension instead of showing an error when it is inactive.

### Fixed

- Handle CRLF, trailing whitespace, and non-word language tags when stripping code fences from model output.
- Remove hard `extensionDependency` on `vscode.git` so the web build can activate.
- Remove invalid `web` value from `extensionKind` that blocked `vsce publish`.

## [1.0.0]

### Added

- Generate git commit messages using Claude via the Source Control pane
- Support for Claude Code CLI (desktop) and VS Code Language Model API (web)
- Model selection: haiku, sonnet (default), opus
- Optional file context reading for richer commit messages
- Multi-root workspace support with active editor matching
- Keyboard shortcut: `Ctrl+Shift+Alt+C` / `Cmd+Shift+Alt+C`
