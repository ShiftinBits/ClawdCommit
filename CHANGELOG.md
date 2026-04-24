# Changelog

All notable changes to ClawdCommit will be documented in this file.

## [0.5.0] - 2026-04-23

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

## [0.4.0] - 2026-03-25

### Added

- VS Code for the Web support via the Language Model API (works in vscode.dev, github.dev, and Codespaces).
- Auto-activation of the built-in Git extension when it is inactive.
- 2-minute timeout on the Claude CLI invocation to prevent indefinite hangs.
- Model fallback in the web provider: exact match, then any Anthropic model, then family-only match.

### Changed

- Use the built-in VSCode Git extension API instead of shelling out to `git`.
- Exclude tests, CI workflows, and docs from the packaged `.vsix`.

### Fixed

- Strip code fences wrapped in CRLF line endings, trailing whitespace, or non-word language tags.
- Removed the hard `extensionDependency` on `vscode.git` that prevented web activation.
- Non-Claude API errors now surface distinct messages instead of being swallowed.

## [0.3.1] - 2026-02-11

### Changed

- Single-call architecture for all commits, replacing the map-reduce pipeline.
- Consolidated `analysisModel`, `synthesisModel`, and `singleCallModel` into one `clawdCommit.model` setting (default: `sonnet`).
- `includeFileContext` now lets Claude choose which files to read rather than inlining full file contents.

### Removed

- `parallelFileThreshold` and `maxConcurrentAgents` settings.

## [0.3.0] - 2026-02-10

### Added

- Keyboard shortcut: `Ctrl+Shift+Alt+C` (macOS: `Cmd+Shift+Alt+C`) to generate a commit message from the keyboard when a Git SCM view is active.

### Changed

- Fetch the staged diff and recent commit log concurrently via `Promise.allSettled`.
- Buffer-based stdout/stderr collection with a single concatenation on close.
- Increased subprocess `maxBuffer` for git commands (10 MB) and staged file content (512 KB).
- Cancellation now propagates through git operations and the pipeline via `AbortSignal`.
- Cleaner notification text — removed the redundant `ClawdCommit:` prefix and trailing ellipses.

## [0.2.0] - 2026-02-09

### Added

- Parallel agent architecture (map-reduce) for multi-file commits, producing better messages on large diffs.

## [0.1.1] - 2026-02-08

### Changed

- Default model is now explicitly `sonnet`.

## [0.1.0] - 2026-02-08

### Added

- Initial release: generate commit messages from the Source Control title bar using the Claude Code CLI.
- Style-aware output that matches the project's recent commit history.
- Cancellable generation via the progress notification.
