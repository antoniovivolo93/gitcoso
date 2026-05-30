import type { RepositorySnapshot } from "./types.js";

export const emptySnapshot: RepositorySnapshot = {
  path: null,
  name: "No repository selected",
  activeBranch: "",
  lastUpdated: new Date().toISOString(),
  statusSummary: "Select a Git repository folder to begin",
  branches: [],
  commits: []
};
