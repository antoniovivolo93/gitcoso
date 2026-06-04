import { contextBridge, ipcRenderer } from "electron";
import type { GitCosoApi } from "../src/shared/types.js";

const api: GitCosoApi = {
  openRepository: () => ipcRenderer.invoke("repo:open"),
  refreshRepository: (repoPath) => ipcRenderer.invoke("repo:refresh", repoPath),
  getCommitDetails: (repoPath, hash) => ipcRenderer.invoke("commit:details", repoPath, hash),
  checkoutBranch: (repoPath, branch) => ipcRenderer.invoke("branch:checkout", repoPath, branch),
  checkoutRemoteBranch: (repoPath, remoteBranch) =>
    ipcRenderer.invoke("branch:checkout-remote", repoPath, remoteBranch),
  createBranch: (repoPath, name, checkout) =>
    ipcRenderer.invoke("branch:create", repoPath, name, checkout),
  commit: (repoPath, message) => ipcRenderer.invoke("repo:commit", repoPath, message),
  stageFile: (repoPath, filePath) => ipcRenderer.invoke("repo:stage-file", repoPath, filePath),
  stageFolder: (repoPath, folderPath) => ipcRenderer.invoke("repo:stage-folder", repoPath, folderPath),
  stageAll: (repoPath) => ipcRenderer.invoke("repo:stage-all", repoPath),
  unstageFile: (repoPath, filePath) => ipcRenderer.invoke("repo:unstage-file", repoPath, filePath),
  unstageFolder: (repoPath, folderPath) => ipcRenderer.invoke("repo:unstage-folder", repoPath, folderPath),
  unstageAll: (repoPath) => ipcRenderer.invoke("repo:unstage-all", repoPath),
  discardFile: (repoPath, filePath) => ipcRenderer.invoke("repo:discard-file", repoPath, filePath),
  commitAdvanced: (request) => ipcRenderer.invoke("repo:commit-advanced", request),
  getFileDiff: (repoPath, filePath, staged) => ipcRenderer.invoke("repo:file-diff", repoPath, filePath, staged),
  openFile: (repoPath, filePath) => ipcRenderer.invoke("repo:open-file", repoPath, filePath),
  onRepositoryChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, repoPath: string) => callback(repoPath);
    ipcRenderer.on("repo:changed", listener);
    return () => ipcRenderer.removeListener("repo:changed", listener);
  },
  stashAndCheckout: (repoPath, branch) => ipcRenderer.invoke("branch:stash-and-checkout", repoPath, branch),
  fetch: (repoPath) => ipcRenderer.invoke("repo:fetch", repoPath),
  pull: (repoPath) => ipcRenderer.invoke("repo:pull", repoPath),
  push: (repoPath) => ipcRenderer.invoke("repo:push", repoPath),
  pullRebaseBranch: (request) => ipcRenderer.invoke("branch-action:pull-rebase", request),
  pushBranch: (request) => ipcRenderer.invoke("branch-action:push", request),
  setBranchUpstream: (request) => ipcRenderer.invoke("branch-action:set-upstream", request),
  createBranchAtCommit: (request) => ipcRenderer.invoke("branch-action:create-branch-at", request),
  resetBranchToCommit: (request) => ipcRenderer.invoke("branch-action:reset-to-commit", request),
  editCommitMessage: (request) => ipcRenderer.invoke("branch-action:edit-commit-message", request),
  revertCommit: (request) => ipcRenderer.invoke("branch-action:revert-commit", request),
  dropCommit: (request) => ipcRenderer.invoke("branch-action:drop-commit", request),
  renameBranch: (request) => ipcRenderer.invoke("branch-action:rename", request),
  deleteBranch: (request) => ipcRenderer.invoke("branch-action:delete", request),
  createTagAtCommit: (request) => ipcRenderer.invoke("branch-action:create-tag", request),
  createAnnotatedTagAtCommit: (request) => ipcRenderer.invoke("branch-action:create-annotated-tag", request),
  compareCommitWithWorkingDirectory: (request) =>
    ipcRenderer.invoke("branch-action:compare-working-directory", request),
  explainBranchChanges: (request) => ipcRenderer.invoke("branch-action:explain-changes", request),
  applyPatch: (request) => ipcRenderer.invoke("branch-action:apply-patch", request)
};

contextBridge.exposeInMainWorld("gitCoso", api);
