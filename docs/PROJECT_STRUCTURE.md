# GitCoso Project Structure

GitCoso is an Electron desktop app with a React renderer and a Git service in the Electron main process.

## Root Files

- `package.json` defines scripts, dependencies, and the Electron entrypoint.
- `index.html` hosts the React renderer root.
- `vite.config.ts` configures Vite for the renderer app.
- `tsconfig.json` configures TypeScript for the React renderer.
- `tailwind.config.js` and `postcss.config.js` configure styling.
- `README.md` contains setup and usage instructions for users.

## Electron Layer

- `electron/main.ts` creates the desktop window, registers IPC handlers, opens the folder picker, and calls the Git service.
- `electron/preload.cts` exposes the safe `window.gitCoso` API to the renderer. It compiles to `dist-electron/electron/preload.cjs`.
- `electron/gitService.ts` wraps real Git operations through `simple-git` and maps Git output into app types.
- `electron/tsconfig.json` compiles Electron files separately from the renderer.

## Renderer Layer

- `src/main.tsx` mounts React into `#root`.
- `src/App.tsx` owns the main desktop layout, topbar actions, and dialogs.
- `src/styles.css` contains Tailwind directives and global desktop styling.

## Shared Model

- `src/shared/types.ts` defines shared IPC/domain types such as `RepositorySnapshot`, `CommitNode`, `Branch`, and `CommitDetails`.
- `src/shared/initialState.ts` defines the empty startup state before a repository is selected.

## State

- `src/store/repositoryStore.ts` is the Zustand store for repository data, selected commit, loading/error state, and desktop bridge availability.

## Components

- `src/components/Sidebar.tsx` renders repository info and local/remote branches.
- `src/components/CommitGraph.tsx` renders the commit tree, straight branch lines, and author avatars.
- `src/components/CommitDetailsPanel.tsx` renders selected commit metadata, changed files, and diff summary.
- `src/components/dialogs/CreateBranchDialog.tsx` handles branch creation.
- `src/components/dialogs/CommitDialog.tsx` commits already staged files.
- `src/components/ui/Button.tsx` is the shared button component.

## Build Outputs

- `dist/` is the Vite renderer build output.
- `dist-electron/` is the Electron TypeScript build output.
- Both folders are generated artifacts and should not be edited manually.
