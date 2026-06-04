export type BranchKind = "local" | "remote";

export type Branch = {
  name: string;
  current: boolean;
  kind: BranchKind;
  remoteName?: string;
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
  oldPath?: string;
  status: "added" | "modified" | "deleted" | "renamed" | "copied" | "unknown";
  staged?: boolean;
  conflicted?: boolean;
  additions?: number;
  deletions?: number;
};

export type CommitOptions = {
  signOff: boolean;
  allowEmpty: boolean;
  noVerify: boolean;
  author?: string;
  date?: string;
};

export type CommitRequest = {
  repoPath: string;
  summary: string;
  description?: string;
  amend?: boolean;
  options?: Partial<CommitOptions>;
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

export type WorkingDirectoryStatus = {
  hasUncommittedChanges: boolean;
  stagedFiles: ChangedFile[];
  unstagedFiles: ChangedFile[];
  conflictedFiles: string[];
  rebaseInProgress: boolean;
  mergeInProgress: boolean;
};

export type GitRemote = {
  name: string;
  fetch?: string;
  push?: string;
};

export type RepositorySnapshot = {
  path: string | null;
  name: string;
  activeBranch: string;
  remotes: GitRemote[];
  branches: Branch[];
  commits: CommitNode[];
  workingDirectoryStatus: WorkingDirectoryStatus;
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
  snapshot?: RepositorySnapshot;
  data?: Record<string, unknown>;
};

export type BranchContext = {
  repositoryPath: string;
  branchName: string;
  branchType: BranchKind;
  remoteName?: string;
  remoteUrl?: string;
  commitSha: string;
  currentBranch: string;
  upstream?: string;
  isCheckedOut: boolean;
  isProtectedBranch?: boolean;
  workingDirectoryStatus: WorkingDirectoryStatus;
  stagedFiles: ChangedFile[];
  unstagedFiles: ChangedFile[];
};

export type ResetMode = "soft" | "mixed" | "hard";

export type BranchActionRequest = {
  context: BranchContext;
  newBranchName?: string;
  checkout?: boolean;
  resetMode?: ResetMode;
  newMessage?: string;
  mainlineParent?: number;
  remoteBranch?: string;
  remoteName?: string;
  newName?: string;
  force?: boolean;
  tagName?: string;
  tagMessage?: string;
  patch?: string;
};

export type GitCosoApi = {
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
  checkoutRemoteBranch: (
    repoPath: string,
    remoteBranch: string,
  ) => Promise<RepositorySnapshot>;
  createBranch: (
    repoPath: string,
    name: string,
    checkout: boolean,
  ) => Promise<RepositorySnapshot>;
  commit: (repoPath: string, message: string) => Promise<RepositorySnapshot>;
  stageFile: (repoPath: string, filePath: string) => Promise<RepositorySnapshot>;
  stageFolder: (repoPath: string, folderPath: string) => Promise<RepositorySnapshot>;
  stageAll: (repoPath: string) => Promise<RepositorySnapshot>;
  unstageFile: (repoPath: string, filePath: string) => Promise<RepositorySnapshot>;
  unstageFolder: (repoPath: string, folderPath: string) => Promise<RepositorySnapshot>;
  unstageAll: (repoPath: string) => Promise<RepositorySnapshot>;
  discardFile: (repoPath: string, filePath: string) => Promise<RepositorySnapshot>;
  commitAdvanced: (request: CommitRequest) => Promise<RepositorySnapshot>;
  getFileDiff: (repoPath: string, filePath: string, staged: boolean) => Promise<string>;
  openFile: (repoPath: string, filePath: string) => Promise<void>;
  onRepositoryChanged: (callback: (repoPath: string) => void) => () => void;
  stashAndCheckout: (
    repoPath: string,
    branch: string,
  ) => Promise<RepositorySnapshot>;
  fetch: (repoPath: string) => Promise<RepositorySnapshot>;
  pull: (repoPath: string) => Promise<RepositorySnapshot>;
  push: (repoPath: string) => Promise<RepositorySnapshot>;
  pullRebaseBranch: (request: BranchActionRequest) => Promise<GitOperationResult>;
  pushBranch: (request: BranchActionRequest) => Promise<GitOperationResult>;
  setBranchUpstream: (request: BranchActionRequest) => Promise<GitOperationResult>;
  createBranchAtCommit: (request: BranchActionRequest) => Promise<GitOperationResult>;
  resetBranchToCommit: (request: BranchActionRequest) => Promise<GitOperationResult>;
  editCommitMessage: (request: BranchActionRequest) => Promise<GitOperationResult>;
  revertCommit: (request: BranchActionRequest) => Promise<GitOperationResult>;
  dropCommit: (request: BranchActionRequest) => Promise<GitOperationResult>;
  renameBranch: (request: BranchActionRequest) => Promise<GitOperationResult>;
  deleteBranch: (request: BranchActionRequest) => Promise<GitOperationResult>;
  createTagAtCommit: (request: BranchActionRequest) => Promise<GitOperationResult>;
  createAnnotatedTagAtCommit: (request: BranchActionRequest) => Promise<GitOperationResult>;
  compareCommitWithWorkingDirectory: (request: BranchActionRequest) => Promise<GitOperationResult>;
  explainBranchChanges: (request: BranchActionRequest) => Promise<GitOperationResult>;
  applyPatch: (request: BranchActionRequest) => Promise<GitOperationResult>;
};

export const branchColors = [
  "#38bdf8",
  "#c084fc",
  "#34d399",
  "#fb7185",
  "#f59e0b",
  "#22d3ee",
  "#a78bfa",
  "#4ade80",
  "#e879f9",
  "#60a5fa",
  "#facc15",
];
