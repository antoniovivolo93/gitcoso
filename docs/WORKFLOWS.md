# BranchFlow Workflows

## Start Development

```bash
npm run dev
```

This starts Vite and opens the Electron desktop window. Folder selection only works inside the Electron window because it depends on the preload bridge.

## Build

```bash
npm run build
```

This compiles:

- renderer TypeScript
- Vite renderer bundle
- Electron main process and preload

## Open Repository

1. User clicks `Open repository folder`.
2. Electron opens a native folder picker.
3. The selected folder is validated with Git.
4. Branches, status, and commit history are loaded into Zustand.
5. The graph and panels render from real repository data.

## Select Commit

1. User clicks a commit row or avatar node area.
2. Store updates `selectedHash`.
3. Renderer requests commit details from Electron.
4. Git service loads changed files and diff summary.
5. Details panel updates.

## Branch Operations

- Local branch click runs checkout.
- Create branch dialog calls Git branch creation and optionally checks it out.
- Fetch, pull, and push run through the topbar actions.

## Commit Operation

The commit dialog creates a commit from files already staged in Git.

Important behavior:

- The app does not currently stage files.
- If no files are staged, Git returns an error and the UI displays it.

## Generated Files

Do not edit generated output:

- `dist/`
- `dist-electron/`
- `node_modules/`

Edit source files under `electron/` and `src/`, then rebuild.
