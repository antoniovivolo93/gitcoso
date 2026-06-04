# GitCoso Architecture

## Runtime Shape

GitCoso has two main runtime contexts:

- Electron main process: owns native capabilities, filesystem dialogs, and Git execution.
- React renderer: owns UI, interaction state, and visual commit graph rendering.

The renderer never imports Node or Git directly. All desktop and Git actions go through `window.gitCoso`, exposed by the preload script.

## IPC Contract

The preload exposes these methods:

- `openRepository()`
- `refreshRepository(repoPath)`
- `getCommitDetails(repoPath, hash)`
- `checkoutBranch(repoPath, branch)`
- `createBranch(repoPath, name, checkout)`
- `commit(repoPath, message)`
- `fetch(repoPath)`
- `pull(repoPath)`
- `push(repoPath)`

Types for these calls live in `src/shared/types.ts`.

## Git Data Flow

1. The renderer calls a method on `window.gitCoso`.
2. `electron/preload.cts` forwards the call to an IPC channel.
3. `electron/main.ts` receives the IPC request.
4. `electron/gitService.ts` runs Git through `simple-git`.
5. The Git result is converted into shared domain types.
6. `src/store/repositoryStore.ts` updates Zustand state.
7. React components re-render from the store.

## Commit Tree

The Git service reads history with:

```text
git log --all --topo-order --date=iso --decorate=short --max-count=250
```

The custom format includes full hash, short hash, author, author email, date, subject, parent hashes, and refs.

`CommitGraph.tsx` draws straight SVG lines between commits and known parent commits. Commit nodes are HTML avatar elements positioned over the SVG layer for reliable image rendering in Electron.

## Avatar Rules

- GitHub noreply emails map to `https://github.com/<username>.png`.
- Other emails map to Gravatar with `identicon` fallback.
- If the image cannot load, the node shows author initials.

## Error Handling

Invalid repositories and failed Git operations return real errors that are surfaced in the UI.
