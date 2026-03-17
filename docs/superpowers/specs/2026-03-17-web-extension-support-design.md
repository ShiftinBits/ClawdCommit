# Web Extension Support for ClawdCommit

## Summary

Add VSCode web extension support to ClawdCommit by introducing a provider abstraction over the Claude integration layer. The existing CLI-based approach remains the primary path on desktop. A new `vscode.lm` Language Model API provider serves as a fallback for web environments (vscode.dev, github.dev, Codespaces) where spawning subprocesses is impossible.

## Context

ClawdCommit generates AI-powered git commit messages by spawning the `claude` CLI as a subprocess. This architecture is fundamentally incompatible with VSCode's web extension host, which runs in a browser sandbox without access to Node.js APIs (`child_process`, `Buffer`, `fs`).

The VSCode Language Model API (`vscode.lm`) provides a web-compatible path to access Claude models registered by other extensions (via Copilot, BYOK, or third-party providers).

## Design

### Provider Abstraction

A `CommitMessageProvider` interface replaces direct `runClaude()` usage:

```typescript
// src/providers/types.ts
export interface CommitMessageProvider {
    generateMessage(
        instruction: string,
        context: string,
        token: vscode.CancellationToken,
        options?: { model?: string }
    ): Promise<string | undefined>;
}
```

Two implementations:

- **`CliProvider`** (`src/providers/cliProvider.ts`) — Wraps the existing `child_process.spawn('claude', ...)` logic from `claude.ts`. Accepts `cwd` at construction time. Used on desktop when the CLI is available.
- **`LmApiProvider`** (`src/providers/lmApiProvider.ts`) — Uses `vscode.lm.selectChatModels()` to find a Claude model and sends the prompt via the Language Model API. Used in web environments or when the CLI is unavailable.

### Provider Selection

Provider selection happens in `extension.ts` based on environment detection:

```typescript
function selectProvider(repoRoot: string): CommitMessageProvider {
    if (typeof process !== 'undefined' && process.versions?.node) {
        return new CliProvider(repoRoot);
    }
    return new LmApiProvider();
}
```

- Desktop with Node.js: `CliProvider` (current behavior preserved)
- Web / no Node.js: `LmApiProvider`

### Model Mapping

The existing `clawdCommit.model` setting (`haiku`/`sonnet`/`opus`) maps to LM API family selectors:

| Setting | LM API family selector |
|---------|----------------------|
| `haiku` | `claude-haiku` |
| `sonnet` | `claude-sonnet` |
| `opus` | `claude-opus` |

If the exact model family isn't found, fall back to any available Claude model. If no Claude model is available at all, show an error guiding the user to configure one via Copilot or BYOK.

### `includeFileContext` Setting

- **CLI path:** Works as today — tells Claude it can read files in the working directory.
- **LM API path:** The instruction is included in the prompt but effectively ignored since the language model has no filesystem access. No user-facing change needed.

### Git Data

The extension requires the `vscode.git` extension for diffs and commit history. This is unchanged. Web environments without the git extension (e.g., vscode.dev with virtual filesystems) will see the existing "Git extension not found" error. Environments with full git support (Codespaces, remote containers) work normally.

### Build Changes

**esbuild.js** — Two build configurations:

```javascript
// Node/desktop build (existing)
{ entryPoints: ['src/extension.ts'], platform: 'node', outfile: 'dist/extension.js' }

// Web build (new)
{ entryPoints: ['src/extension.ts'], platform: 'browser', outfile: 'dist/web/extension.js' }
```

The web build tree-shakes `child_process` since `CliProvider` is never instantiated in the browser code path.

**package.json:**

```json
{
  "main": "./dist/extension.js",
  "browser": "./dist/web/extension.js"
}
```

**tsconfig.json** — Add `"WebWorker"` to `lib` for web API type-checking.

### No New Dependencies

The `vscode.lm` API is built into VSCode. No npm packages are added.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/providers/types.ts` | Create | `CommitMessageProvider` interface |
| `src/providers/cliProvider.ts` | Create | CLI-based provider (logic from `claude.ts`) |
| `src/providers/lmApiProvider.ts` | Create | Language Model API provider |
| `src/claude.ts` | Delete | Logic moves into `CliProvider` |
| `src/extension.ts` | Modify | Add provider selection, pass provider to `generateCommitMessage` |
| `src/generateCommitMessage.ts` | Modify | Accept `CommitMessageProvider` parameter instead of calling `runClaude` |
| `esbuild.js` | Modify | Add web build configuration |
| `package.json` | Modify | Add `"browser"` entry point |
| `tsconfig.json` | Modify | Add `"WebWorker"` to `lib` |

## Files Not Changed

- `src/prompts.ts` — No changes needed
- `src/settings.ts` — No changes needed
- `src/git.ts` — No changes needed

## Error Handling

- **No Claude model available (LM API):** Show error message: "No Claude model found. Configure a Claude model via GitHub Copilot or VS Code's Bring Your Own Key settings."
- **CLI not found (desktop):** Existing ENOENT error preserved in `CliProvider`
- **Git extension unavailable:** Existing error handling in `git.ts` unchanged
- **LM API request failure:** Catch and show error message, return `undefined`
- **User cancellation:** Both providers respect `CancellationToken`

## Testing

- Existing tests for `claude.ts` logic adapt to test `CliProvider`
- New tests for `LmApiProvider` mock `vscode.lm.selectChatModels()`
- `generateCommitMessage` tests updated to inject a mock provider
- Build verification: both `dist/extension.js` and `dist/web/extension.js` produce valid bundles
