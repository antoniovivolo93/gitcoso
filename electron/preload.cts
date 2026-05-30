import { contextBridge, ipcRenderer } from "electron";
import type { BranchFlowApi } from "../src/shared/types.js";

const api: BranchFlowApi = {
  openRepository: () => ipcRenderer.invoke("repo:open"),
  refreshRepository: (repoPath) => ipcRenderer.invoke("repo:refresh", repoPath),
  getCommitDetails: (repoPath, hash) => ipcRenderer.invoke("commit:details", repoPath, hash),
  checkoutBranch: (repoPath, branch) => ipcRenderer.invoke("branch:checkout", repoPath, branch),
  createBranch: (repoPath, name, checkout) =>
    ipcRenderer.invoke("branch:create", repoPath, name, checkout),
  commit: (repoPath, message) => ipcRenderer.invoke("repo:commit", repoPath, message),
  stashAndCheckout: (repoPath, branch) => ipcRenderer.invoke("branch:stash-and-checkout", repoPath, branch),
  fetch: (repoPath) => ipcRenderer.invoke("repo:fetch", repoPath),
  pull: (repoPath) => ipcRenderer.invoke("repo:pull", repoPath),
  push: (repoPath) => ipcRenderer.invoke("repo:push", repoPath)
};

contextBridge.exposeInMainWorld("branchFlow", api);
