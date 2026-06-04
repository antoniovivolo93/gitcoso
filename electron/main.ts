import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { watch, type FSWatcher } from "node:fs";
import {
  applyPatch,
  checkoutBranch,
  checkoutRemoteBranch,
  commitAdvanced,
  commitChanges,
  compareCommitWithWorkingDirectory,
  createAnnotatedTagAtCommit,
  createBranch,
  createBranchAtCommit,
  createTagAtCommit,
  deleteBranch,
  discardFile,
  dropCommit,
  editCommitMessage,
  explainBranchChanges,
  fetchRepository,
  getFileDiff,
  getCommitDetails,
  getRepositorySnapshot,
  pullRebaseBranch,
  pullRepository,
  pushRepository,
  pushBranch,
  renameBranch,
  resetBranchToCommit,
  revertCommit,
  setBranchUpstream,
  stageAll,
  stageFile,
  stageFolder,
  stashAndCheckoutBranch,
  unstageAll,
  unstageFile,
  unstageFolder
} from "./gitService.js";
import { emptySnapshot } from "../src/shared/initialState.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const repositoryWatchers = new Map<string, { watcher: FSWatcher; timeout: NodeJS.Timeout | null }>();

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 720,
    title: "GitCoso",
    backgroundColor: "#070912",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function registerIpcHandlers() {
  ipcMain.handle("repo:open", async () => {
    const result = await dialog.showOpenDialog({
      title: "Open Git Repository",
      properties: ["openDirectory"]
    });

    if (result.canceled || !result.filePaths[0]) {
      return emptySnapshot;
    }

    const snapshot = await getRepositorySnapshot(result.filePaths[0]);
    watchRepository(result.filePaths[0]);
    return snapshot;
  });

  ipcMain.handle("repo:refresh", async (_event, repoPath: string) => {
    watchRepository(repoPath);
    return getRepositorySnapshot(repoPath);
  });
  ipcMain.handle("commit:details", (_event, repoPath: string | null, hash: string) =>
    getCommitDetails(repoPath, hash)
  );
  ipcMain.handle("branch:checkout", (_event, repoPath: string, branch: string) =>
    checkoutBranch(repoPath, branch)
  );
  ipcMain.handle("branch:checkout-remote", (_event, repoPath: string, remoteBranch: string) =>
    checkoutRemoteBranch(repoPath, remoteBranch)
  );
  ipcMain.handle("branch:create", (_event, repoPath: string, name: string, checkout: boolean) =>
    createBranch(repoPath, name, checkout)
  );
  ipcMain.handle("branch:stash-and-checkout", (_event, repoPath: string, branch: string) =>
    stashAndCheckoutBranch(repoPath, branch)
  );
  ipcMain.handle("repo:commit", (_event, repoPath: string, message: string) =>
    commitChanges(repoPath, message)
  );
  ipcMain.handle("repo:stage-file", (_event, repoPath: string, filePath: string) =>
    stageFile(repoPath, filePath)
  );
  ipcMain.handle("repo:stage-folder", (_event, repoPath: string, folderPath: string) =>
    stageFolder(repoPath, folderPath)
  );
  ipcMain.handle("repo:stage-all", (_event, repoPath: string) => stageAll(repoPath));
  ipcMain.handle("repo:unstage-file", (_event, repoPath: string, filePath: string) =>
    unstageFile(repoPath, filePath)
  );
  ipcMain.handle("repo:unstage-folder", (_event, repoPath: string, folderPath: string) =>
    unstageFolder(repoPath, folderPath)
  );
  ipcMain.handle("repo:unstage-all", (_event, repoPath: string) => unstageAll(repoPath));
  ipcMain.handle("repo:discard-file", (_event, repoPath: string, filePath: string) =>
    discardFile(repoPath, filePath)
  );
  ipcMain.handle("repo:commit-advanced", (_event, request) => commitAdvanced(request));
  ipcMain.handle("repo:file-diff", (_event, repoPath: string, filePath: string, staged: boolean) =>
    getFileDiff(repoPath, filePath, staged)
  );
  ipcMain.handle("repo:open-file", async (_event, repoPath: string, filePath: string) => {
    const result = await shell.openPath(path.join(repoPath, filePath));
    if (result) throw new Error(result);
  });
  ipcMain.handle("repo:fetch", (_event, repoPath: string) => fetchRepository(repoPath));
  ipcMain.handle("repo:pull", (_event, repoPath: string) => pullRepository(repoPath));
  ipcMain.handle("repo:push", (_event, repoPath: string) => pushRepository(repoPath));
  ipcMain.handle("branch-action:pull-rebase", (_event, request) => pullRebaseBranch(request));
  ipcMain.handle("branch-action:push", (_event, request) => pushBranch(request));
  ipcMain.handle("branch-action:set-upstream", (_event, request) => setBranchUpstream(request));
  ipcMain.handle("branch-action:create-branch-at", (_event, request) => createBranchAtCommit(request));
  ipcMain.handle("branch-action:reset-to-commit", (_event, request) => resetBranchToCommit(request));
  ipcMain.handle("branch-action:edit-commit-message", (_event, request) => editCommitMessage(request));
  ipcMain.handle("branch-action:revert-commit", (_event, request) => revertCommit(request));
  ipcMain.handle("branch-action:drop-commit", (_event, request) => dropCommit(request));
  ipcMain.handle("branch-action:rename", (_event, request) => renameBranch(request));
  ipcMain.handle("branch-action:delete", (_event, request) => deleteBranch(request));
  ipcMain.handle("branch-action:create-tag", (_event, request) => createTagAtCommit(request));
  ipcMain.handle("branch-action:create-annotated-tag", (_event, request) => createAnnotatedTagAtCommit(request));
  ipcMain.handle("branch-action:compare-working-directory", (_event, request) => compareCommitWithWorkingDirectory(request));
  ipcMain.handle("branch-action:explain-changes", (_event, request) => explainBranchChanges(request));
  ipcMain.handle("branch-action:apply-patch", (_event, request) => applyPatch(request));
}

function watchRepository(repoPath: string) {
  if (repositoryWatchers.has(repoPath)) return;

  try {
    const watcher = watch(repoPath, { recursive: true }, (_eventType, filename) => {
      const relativePath = typeof filename === "string" ? filename.replace(/\\/g, "/") : "";
      const pathParts = relativePath.split("/");
      if (
        pathParts.includes(".git")
        || pathParts.includes("node_modules")
        || pathParts.includes("dist")
        || pathParts.includes("dist-electron")
      ) return;
      const state = repositoryWatchers.get(repoPath);
      if (!state) return;
      if (state.timeout) {
        clearTimeout(state.timeout);
      }
      state.timeout = setTimeout(() => {
        BrowserWindow.getAllWindows().forEach((window) => {
          window.webContents.send("repo:changed", repoPath);
        });
      }, 450);
    });
    repositoryWatchers.set(repoPath, { watcher, timeout: null });
  } catch {
    // File watching is best-effort; manual refresh remains available.
  }
}

app.on("before-quit", () => {
  repositoryWatchers.forEach(({ watcher, timeout }) => {
    if (timeout) clearTimeout(timeout);
    watcher.close();
  });
  repositoryWatchers.clear();
});
