# Repository Guidelines

## Project Structure & Module Organization

GitCoso is a Vite + React + Electron desktop app. Renderer code lives in `src/`, with UI in `src/components/`, Zustand stores in `src/store/`, shared contracts in `src/shared/`, and utilities in `src/lib/`. Electron main-process and Git integration code lives in `electron/`, especially `main.ts`, `preload.cts`, and `gitService.ts`. Documentation is in `docs/`. Build outputs in `dist/` and `dist-electron/` are generated; do not edit them directly.

## Build, Test, and Development Commands

- `npm run dev`: starts Vite and Electron together for local desktop development.
- `npm run dev:renderer`: starts only the renderer at `127.0.0.1`.
- `npm run dev:electron`: compiles Electron and connects it to the renderer on port `5173`.
- `npm run build`: runs TypeScript checks, builds the Vite renderer, then compiles Electron.
- `npm run preview`: serves the production renderer build locally.

There is currently no `npm test` script. Use `npm run build` as the minimum verification before handing off changes.

## Coding Style & Naming Conventions

Use TypeScript throughout. Follow the existing two-space indentation, double quotes, semicolons, and React function component style. Name components and dialogs in PascalCase, for example `CommitDetailsPanel.tsx`. Store modules use camelCase names ending in `Store`, such as `repositoryStore.ts`. Prefer shared contracts in `src/shared/types.ts`.

Keep UI styling in Tailwind class names and reuse local helpers such as `cn` from `src/lib/utils.ts`. Use `lucide-react` icons for controls when an icon exists.

## Testing Guidelines

No automated test framework is configured yet. For Git behavior, validate with at least one real local repository in Electron. For UI changes, run `npm run build` and manually check the relevant desktop flow. If tests are added later, colocate them near the unit under test with `*.test.ts` or `*.test.tsx` naming.

## Commit & Pull Request Guidelines

The current history uses Conventional Commits, for example `feat(fe): enhance Git graph, branch management, and user feedback`. Continue with concise messages such as `fix(electron): handle checkout errors` or `feat(ui): add repository tabs`.

Pull requests should include a summary, verification steps, and screenshots or recordings for visible UI changes. Link issues when available. Call out changes to Electron IPC, Git commands, or repository state because they can affect real working trees.

## Security & Configuration Tips

Never commit local repository paths, secrets, or generated dependency folders. Treat Git operations in `electron/gitService.ts` as user-impacting: prefer explicit arguments, avoid destructive commands, and surface clear errors through the existing IPC/store flow.
