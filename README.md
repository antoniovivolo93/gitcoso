# GitCoso

GitCoso is a modern desktop Git client built with Electron, React, TypeScript, Tailwind CSS, Zustand, and `simple-git`.

The interface is intentionally original: dark professional UI, visual commit graph, branch sidebar, commit details, and quick Git actions without using any third-party product branding or assets.

## Features

- Open a local Git repository folder through the native desktop dialog.
- View local and remote branches.
- Browse a visual commit tree from real Git history across all local and remote branches.
- Inspect merge commits through parent-aware graph connections.
- Inspect commit metadata, changed files, and a compact diff summary.
- Run base Git operations: checkout branch, create branch, commit staged changes, fetch, pull, and push.

## Requirements

- Node.js 20+
- npm 10+
- Git CLI available in PATH

Rust is not required because GitCoso uses Electron for its desktop shell.

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

This starts Vite and launches the Electron desktop shell.

## Build

```bash
npm run build
```

The command compiles the React renderer, Electron main process, and preload script.

## Git Notes

GitCoso uses the Git CLI through `simple-git`. Commit operations currently commit only files that are already staged.

If a selected folder is not a Git repository, GitCoso keeps the repository selector active and shows the error in the repository status area.

## Project Structure

```text
electron/
  main.ts          Electron window and IPC handlers
  preload.cts      Safe renderer API bridge
  gitService.ts    Git operations and repository snapshot mapping
src/
  components/      Application UI
  store/           Zustand repository state
  shared/          Shared types and initial empty state
  lib/             Small UI utilities
```
