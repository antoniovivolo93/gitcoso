export type BranchKind = "local" | "remote";

export type Branch = {
  name: string;
  current: boolean;
  kind: BranchKind;
  upstream?: string;
  ahead?: number;
  behind?: number;
  lastCommit?: string;
};

export type CommitNode = {
  hash: string;
  shortHash: string;
  author: string;
  authorEmail: string;
  avatarUrl: string;
  date: string;
  message: string;
  parents: string[];
  refs: string[];
  lane: number;
  color: string;
};

export type ChangedFile = {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "copied" | "unknown";
  additions?: number;
  deletions?: number;
};

export type CommitDetails = {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  message: string;
  body?: string;
  files: ChangedFile[];
  diff: string;
};

export type RepositorySnapshot = {
  path: string | null;
  name: string;
  activeBranch: string;
  branches: Branch[];
  commits: CommitNode[];
  lastUpdated: string;
  statusSummary?: string;
};

export type CheckoutBlockedError = {
  type: "checkout-blocked";
  message: string;
  branch: string;
  files: string[];
};

export type GitOperationResult = {
  ok: boolean;
  message: string;
};

export type BranchFlowApi = {
  openRepository: () => Promise<RepositorySnapshot>;
  refreshRepository: (repoPath: string) => Promise<RepositorySnapshot>;
  getCommitDetails: (
    repoPath: string | null,
    hash: string,
  ) => Promise<CommitDetails>;
  checkoutBranch: (
    repoPath: string,
    branch: string,
  ) => Promise<RepositorySnapshot>;
  createBranch: (
    repoPath: string,
    name: string,
    checkout: boolean,
  ) => Promise<RepositorySnapshot>;
  commit: (repoPath: string, message: string) => Promise<RepositorySnapshot>;
  stashAndCheckout: (
    repoPath: string,
    branch: string,
  ) => Promise<RepositorySnapshot>;
  fetch: (repoPath: string) => Promise<RepositorySnapshot>;
  pull: (repoPath: string) => Promise<RepositorySnapshot>;
  push: (repoPath: string) => Promise<RepositorySnapshot>;
};

export const branchColors = [
  "#8b5cf6",
  "#38bdf8",
  "#34d399",
  "#fb7185",
  "#fbbf24",
  "#a78bfa",
  "#22d3ee",
  "#f97316",
  "#4ade80",
  "#e879f9",
  "#60a5fa",
  "#facc15",
];
