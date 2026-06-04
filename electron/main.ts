import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkoutBranch,
  checkoutRemoteBranch,
  commitChanges,
  createBranch,
  fetchRepository,
  getCommitDetails,
  getRepositorySnapshot,
  pullRepository,
  pushRepository,
  stashAndCheckoutBranch
} from "./gitService.js";
import { emptySnapshot } from "../src/shared/initialState.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

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

    return getRepositorySnapshot(result.filePaths[0]);
  });

  ipcMain.handle("repo:refresh", (_event, repoPath: string) => getRepositorySnapshot(repoPath));
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
  ipcMain.handle("repo:fetch", (_event, repoPath: string) => fetchRepository(repoPath));
  ipcMain.handle("repo:pull", (_event, repoPath: string) => pullRepository(repoPath));
  ipcMain.handle("repo:push", (_event, repoPath: string) => pushRepository(repoPath));
}
