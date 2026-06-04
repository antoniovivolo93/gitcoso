import type { RepositorySnapshot } from "./types.js";

export const emptySnapshot: RepositorySnapshot = {
  path: null,
  name: "No repository selected",
  activeBranch: "",
  remotes: [],
  lastUpdated: new Date().toISOString(),
  statusSummary: "Select a Git repository folder to begin",
  workingDirectoryStatus: {
    hasUncommittedChanges: false,
    stagedFiles: [],
    unstagedFiles: [],
    conflictedFiles: [],
    rebaseInProgress: false,
    mergeInProgress: false
  },
  branches: [],
  commits: []
};
