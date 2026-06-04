import { create } from "zustand";
import type { CheckoutBlockedError, CommitDetails, CommitNode, CommitOptions, RepositorySnapshot } from "../shared/types";
import { emptySnapshot } from "../shared/initialState";

export const WORKING_TREE_SELECTION = "__gitcoso_working_tree__";

type ToastState = {
  id: number;
  type: "success" | "info" | "error";
  message: string;
};

export type CommandLogEntry = {
  id: number;
  command: string;
  status: "running" | "success" | "error";
  createdAt: string;
  message?: string;
};

type RepositoryState = {
  repositories: RepositoryWorkspace[];
  activeRepositoryPath: string | null;
  snapshot: RepositorySnapshot;
  selectedHash: string;
  selectedDetails: CommitDetails | null;
  loading: boolean;
  error: string | null;
  toast: ToastState | null;
  commandLogs: CommandLogEntry[];
  checkoutBlocked: CheckoutBlockedError | null;
  desktopReady: boolean;
  syncDesktopBridge: () => void;
  clearToast: () => void;
  notify: (type: ToastState["type"], message: string) => void;
  clearCommandLogs: () => void;
  clearCheckoutBlocked: () => void;
  applySnapshot: (snapshot: RepositorySnapshot) => Promise<void>;
  setActiveRepository: (repoPath: string) => Promise<void>;
  closeRepository: (repoPath: string) => void;
  setSelectedCommit: (hash: string) => Promise<void>;
  selectWorkingTree: () => void;
  openRepository: () => Promise<void>;
  refresh: (silent?: boolean) => Promise<void>;
  checkoutBranch: (branch: string) => Promise<void>;
  checkoutRemoteBranch: (remoteBranch: string) => Promise<void>;
  stashAndCheckout: () => Promise<void>;
  createBranch: (name: string, checkout: boolean) => Promise<void>;
  commit: (message: string) => Promise<void>;
  stageFile: (filePath: string) => Promise<void>;
  stageFolder: (folderPath: string) => Promise<void>;
  stageAll: () => Promise<void>;
  unstageFile: (filePath: string) => Promise<void>;
  unstageFolder: (folderPath: string) => Promise<void>;
  unstageAll: () => Promise<void>;
  discardFile: (filePath: string) => Promise<void>;
  commitAdvanced: (summary: string, description: string, amend: boolean, options: Partial<CommitOptions>) => Promise<void>;
  showFileDiff: (filePath: string, staged: boolean) => Promise<void>;
  openFile: (filePath: string) => Promise<void>;
  fetch: () => Promise<void>;
  pull: () => Promise<void>;
  push: () => Promise<void>;
};

type RepositorySet = (
  partial: Partial<RepositoryState> | ((state: RepositoryState) => Partial<RepositoryState>),
) => void;

export type RepositoryWorkspace = {
  path: string;
  snapshot: RepositorySnapshot;
  selectedHash: string;
  selectedDetails: CommitDetails | null;
};

export const useRepositoryStore = create<RepositoryState>((set, get) => ({
  repositories: [],
  activeRepositoryPath: null,
  snapshot: emptySnapshot,
  selectedHash: "",
  selectedDetails: null,
  loading: false,
  error: null,
  toast: null,
  commandLogs: [],
  checkoutBlocked: null,
  desktopReady: Boolean(window.gitCoso),

  syncDesktopBridge: () => {
    set({ desktopReady: Boolean(window.gitCoso) });
  },

  clearToast: () => {
    set({ toast: null });
  },

  notify: (type, message) => {
    setToast(set, type, message);
  },

  clearCommandLogs: () => {
    set({ commandLogs: [] });
  },

  clearCheckoutBlocked: () => {
    set({ checkoutBlocked: null });
  },

  applySnapshot: async (snapshot) => {
    const current = get();
    const { selectedHash, selectedDetails } = await resolveSnapshotSelection(snapshot, current.selectedHash);
    set((state) => {
      if (!snapshot.path) {
        return { snapshot, selectedHash, selectedDetails };
      }
      const repositories = upsertWorkspace(state.repositories, {
        path: snapshot.path,
        snapshot,
        selectedHash,
        selectedDetails,
      });
      const shouldActivate = state.activeRepositoryPath === snapshot.path || !state.activeRepositoryPath;
      return {
        repositories,
        activeRepositoryPath: shouldActivate ? snapshot.path : state.activeRepositoryPath,
        snapshot: shouldActivate ? snapshot : state.snapshot,
        selectedHash: shouldActivate ? selectedHash : state.selectedHash,
        selectedDetails: shouldActivate ? selectedDetails : state.selectedDetails,
        checkoutBlocked: null,
        error: null,
      };
    });
  },

  setActiveRepository: async (repoPath) => {
    const workspace = get().repositories.find((repo) => repo.path === repoPath);
    if (!workspace) return;

    const selectedHash = workspace.selectedHash || workspace.snapshot.commits[0]?.hash || "";
    set({
      activeRepositoryPath: repoPath,
      snapshot: workspace.snapshot,
      selectedHash,
      selectedDetails: workspace.selectedDetails,
      checkoutBlocked: null,
      error: null,
    });

    if (selectedHash && selectedHash !== WORKING_TREE_SELECTION && !workspace.selectedDetails) {
      await get().setSelectedCommit(selectedHash);
    }
  },

  closeRepository: (repoPath) => {
    set((state) => {
      const repositories = state.repositories.filter((repo) => repo.path !== repoPath);
      if (state.activeRepositoryPath !== repoPath) {
        return { repositories };
      }

      const nextWorkspace = repositories[0] ?? null;
      return {
        repositories,
        activeRepositoryPath: nextWorkspace?.path ?? null,
        snapshot: nextWorkspace?.snapshot ?? emptySnapshot,
        selectedHash: nextWorkspace?.selectedHash ?? "",
        selectedDetails: nextWorkspace?.selectedDetails ?? null,
        checkoutBlocked: null,
        error: null,
      };
    });
  },

  setSelectedCommit: async (hash) => {
    if (hash === WORKING_TREE_SELECTION) {
      get().selectWorkingTree();
      return;
    }
    const { snapshot } = get();
    const commandId = startCommand(set, `git show ${hash.slice(0, 7)}`);
    set({ selectedHash: hash, loading: true, error: null });
    try {
      const selectedDetails = await getDesktopApi().getCommitDetails(snapshot.path, hash);
      set((state) => ({
        selectedDetails: state.snapshot.path === snapshot.path ? selectedDetails : state.selectedDetails,
        repositories: updateWorkspaceSelection(state.repositories, snapshot.path, hash, selectedDetails),
      }));
      finishCommand(set, commandId, "success");
    } catch (error) {
      const message = getError(error);
      setErrorState(set, message);
      finishCommand(set, commandId, "error", message);
    } finally {
      set({ loading: false });
    }
  },

  selectWorkingTree: () => {
    const { snapshot } = get();
    if (!snapshot.path) return;
    set((state) => ({
      selectedHash: WORKING_TREE_SELECTION,
      selectedDetails: null,
      repositories: updateWorkspaceSelection(state.repositories, snapshot.path, WORKING_TREE_SELECTION, null),
      error: null,
    }));
  },

  openRepository: async () => {
    await runSnapshotAction(set, async () => getDesktopApi().openRepository(), undefined, "open repository", true);
  },

  refresh: async (silent = false) => {
    const { snapshot } = get();
    if (!snapshot.path) return;
    await runSnapshotAction(
      set,
      async () => getDesktopApi().refreshRepository(snapshot.path!),
      undefined,
      silent ? undefined : "git branch -a && git log --all && git status"
    );
  },

  checkoutBranch: async (branch) => {
    const { snapshot } = get();
    if (!snapshot.path) return;
    await runSnapshotAction(set, async () => getDesktopApi().checkoutBranch(snapshot.path!, branch), branch, `git checkout ${branch}`);
  },

  checkoutRemoteBranch: async (remoteBranch) => {
    const { snapshot } = get();
    if (!snapshot.path) return;
    const api = getDesktopApi();
    if (typeof api.checkoutRemoteBranch !== "function") {
      throw new Error("Desktop bridge is out of date. Close GitCoso completely and restart it with npm run dev.");
    }
    await runSnapshotAction(
      set,
      async () => {
        await api.checkoutRemoteBranch(snapshot.path!, remoteBranch);
        return api.refreshRepository(snapshot.path!);
      },
      remoteBranch,
      `git checkout --track ${remoteBranch}`
    );
  },

  stashAndCheckout: async () => {
    const { snapshot, checkoutBlocked } = get();
    if (!snapshot.path || !checkoutBlocked) return;
    await runSnapshotAction(
      set,
      async () => {
        const api = getDesktopApi();
        if (typeof api.stashAndCheckout !== "function") {
          throw new Error("Desktop bridge is out of date. Close GitCoso completely and restart it with npm run dev.");
        }
        return api.stashAndCheckout(snapshot.path!, checkoutBlocked.branch);
      },
      undefined,
      `git stash push -u && git checkout ${checkoutBlocked.branch}`
    );
  },

  createBranch: async (name, checkout) => {
    const { snapshot } = get();
    if (!snapshot.path) return;
    await runSnapshotAction(set, async () => getDesktopApi().createBranch(snapshot.path!, name, checkout), undefined, checkout ? `git checkout -b ${name}` : `git branch ${name}`);
  },

  commit: async (message) => {
    const { snapshot } = get();
    if (!snapshot.path) return;
    await runSnapshotAction(set, async () => getDesktopApi().commit(snapshot.path!, message), undefined, "git commit");
  },

  stageFile: async (filePath) => {
    const { snapshot } = get();
    if (!snapshot.path) return;
    await runSnapshotAction(set, async () => getDesktopApi().stageFile(snapshot.path!, filePath), undefined, `git add -- ${filePath}`);
  },

  stageFolder: async (folderPath) => {
    const { snapshot } = get();
    if (!snapshot.path) return;
    await runSnapshotAction(set, async () => getDesktopApi().stageFolder(snapshot.path!, folderPath), undefined, `git add -- ${folderPath}`);
  },

  stageAll: async () => {
    const { snapshot } = get();
    if (!snapshot.path) return;
    await runSnapshotAction(set, async () => getDesktopApi().stageAll(snapshot.path!), undefined, "git add -A");
  },

  unstageFile: async (filePath) => {
    const { snapshot } = get();
    if (!snapshot.path) return;
    await runSnapshotAction(set, async () => getDesktopApi().unstageFile(snapshot.path!, filePath), undefined, `git restore --staged -- ${filePath}`);
  },

  unstageFolder: async (folderPath) => {
    const { snapshot } = get();
    if (!snapshot.path) return;
    await runSnapshotAction(set, async () => getDesktopApi().unstageFolder(snapshot.path!, folderPath), undefined, `git restore --staged -- ${folderPath}`);
  },

  unstageAll: async () => {
    const { snapshot } = get();
    if (!snapshot.path) return;
    await runSnapshotAction(set, async () => getDesktopApi().unstageAll(snapshot.path!), undefined, "git restore --staged .");
  },

  discardFile: async (filePath) => {
    const { snapshot } = get();
    if (!snapshot.path) return;
    await runSnapshotAction(set, async () => getDesktopApi().discardFile(snapshot.path!, filePath), undefined, `git restore -- ${filePath}`);
  },

  commitAdvanced: async (summary, description, amend, options) => {
    const { snapshot } = get();
    if (!snapshot.path) return;
    const command = [
      "git commit",
      amend ? "--amend" : "",
      options.signOff ? "--signoff" : "",
      options.allowEmpty ? "--allow-empty" : "",
      options.noVerify ? "--no-verify" : "",
    ].filter(Boolean).join(" ");
    const nextSnapshot = await runSnapshotAction(
      set,
      async () => getDesktopApi().commitAdvanced({
        repoPath: snapshot.path!,
        summary,
        description,
        amend,
        options,
      }),
      undefined,
      command
    );
    if (nextSnapshot) {
      setToast(set, "success", amend ? "Commit amended." : "Commit created.");
    }
  },

  showFileDiff: async (filePath, staged) => {
    const { snapshot } = get();
    if (!snapshot.path) return;
    const commandId = startCommand(set, staged ? `git diff --cached -- ${filePath}` : `git diff -- ${filePath}`);
    set({ loading: true, error: null });
    try {
      const diff = await getDesktopApi().getFileDiff(snapshot.path, filePath, staged);
      setToast(set, "info", diff.trim() ? diff.slice(0, 280) : "No diff available for this file.");
      finishCommand(set, commandId, "success");
    } catch (error) {
      const message = getError(error);
      setErrorState(set, message);
      finishCommand(set, commandId, "error", message);
    } finally {
      set({ loading: false });
    }
  },

  openFile: async (filePath) => {
    const { snapshot } = get();
    if (!snapshot.path) return;
    const commandId = startCommand(set, `open ${filePath}`);
    try {
      await getDesktopApi().openFile(snapshot.path, filePath);
      finishCommand(set, commandId, "success");
    } catch (error) {
      const message = getError(error);
      setErrorState(set, message);
      finishCommand(set, commandId, "error", message);
    }
  },

  fetch: async () => {
    const { snapshot } = get();
    if (!snapshot.path) return;
    await runSnapshotAction(set, async () => getDesktopApi().fetch(snapshot.path!), undefined, "git fetch");
  },

  pull: async () => {
    const { snapshot } = get();
    if (!snapshot.path) return;
    const beforeHead = getBranchHeadHash(snapshot);
    const nextSnapshot = await runSnapshotAction(set, async () => getDesktopApi().pull(snapshot.path!), undefined, "git pull");
    if (!nextSnapshot) return;

    const afterHead = getBranchHeadHash(nextSnapshot);
    const pulledCount = countPulledCommits(nextSnapshot.commits, beforeHead, afterHead);
    set({
      toast: {
        id: Date.now(),
        type: "success",
        message: pulledCount > 0
          ? `Pull completato: ${pulledCount} commit ${pulledCount === 1 ? "scaricato" : "scaricati"}.`
          : "Branch gia allineato.",
      },
    });
  },

  push: async () => {
    const { snapshot } = get();
    if (!snapshot.path) return;
    await runSnapshotAction(set, async () => getDesktopApi().push(snapshot.path!), undefined, "git push");
  }
}));

async function runSnapshotAction(
  set: RepositorySet,
  action: () => Promise<RepositorySnapshot>,
  checkoutBranch?: string,
  command?: string,
  activateSnapshot = false
): Promise<RepositorySnapshot | null> {
  const commandId = command ? startCommand(set, command) : null;
  set({ loading: true, error: null });
  try {
    const snapshot = await action();
    const previousHash = useRepositoryStore.getState().selectedHash;
    const { selectedHash, selectedDetails } = await resolveSnapshotSelection(snapshot, previousHash);
    if (!snapshot.path) {
      if (commandId !== null) {
        finishCommand(set, commandId, "success");
      }
      return null;
    }
    set((state) => {
      const shouldActivate = activateSnapshot || state.activeRepositoryPath === snapshot.path || !state.activeRepositoryPath;
      const repositories = upsertWorkspace(state.repositories, {
        path: snapshot.path!,
        snapshot,
        selectedHash,
        selectedDetails,
      });

      return {
        repositories,
        activeRepositoryPath: shouldActivate ? snapshot.path : state.activeRepositoryPath,
        snapshot: shouldActivate ? snapshot : state.snapshot,
        selectedHash: shouldActivate ? selectedHash : state.selectedHash,
        selectedDetails: shouldActivate ? selectedDetails : state.selectedDetails,
        checkoutBlocked: null,
      };
    });
    if (commandId !== null) {
      finishCommand(set, commandId, "success");
      startCommand(set, "git show --stat --patch", "success");
    }
    return snapshot;
  } catch (error) {
    const checkoutBlocked = parseCheckoutBlockedError(error, checkoutBranch);
    if (checkoutBlocked) {
      set({ checkoutBlocked, error: null });
      if (commandId !== null) {
        finishCommand(set, commandId, "error", checkoutBlocked.message);
      }
      setToast(set, "error", checkoutBlocked.message);
    } else {
      const message = getError(error);
      setErrorState(set, message);
      if (commandId !== null) {
        finishCommand(set, commandId, "error", message);
      }
    }
    return null;
  } finally {
    set({ loading: false });
  }
}

function upsertWorkspace(repositories: RepositoryWorkspace[], workspace: RepositoryWorkspace) {
  const index = repositories.findIndex((repo) => repo.path === workspace.path);
  if (index === -1) {
    return [...repositories, workspace];
  }

  return repositories.map((repo, repoIndex) => repoIndex === index ? workspace : repo);
}

function updateWorkspaceSelection(
  repositories: RepositoryWorkspace[],
  repoPath: string | null,
  selectedHash: string,
  selectedDetails: CommitDetails | null,
) {
  if (!repoPath) {
    return repositories;
  }

  return repositories.map((repo) => repo.path === repoPath
    ? { ...repo, selectedHash, selectedDetails }
    : repo
  );
}

async function resolveSnapshotSelection(
  snapshot: RepositorySnapshot,
  preferredHash?: string,
): Promise<{ selectedHash: string; selectedDetails: CommitDetails | null }> {
  if (!snapshot.path) {
    return { selectedHash: "", selectedDetails: null };
  }

  if (
    preferredHash === WORKING_TREE_SELECTION
    && snapshot.workingDirectoryStatus.hasUncommittedChanges
  ) {
    return { selectedHash: WORKING_TREE_SELECTION, selectedDetails: null };
  }

  const selectedHash = preferredHash && snapshot.commits.some((commit) => commit.hash === preferredHash)
    ? preferredHash
    : snapshot.commits[0]?.hash ?? "";
  const selectedDetails = selectedHash
    ? await getDesktopApi().getCommitDetails(snapshot.path, selectedHash)
    : null;

  return { selectedHash, selectedDetails };
}

function startCommand(
  set: RepositorySet,
  command: string,
  status: CommandLogEntry["status"] = "running",
) {
  const id = Date.now() + Math.floor(Math.random() * 1000);
  set((state) => ({
    commandLogs: [
      ...state.commandLogs.slice(-119),
      {
        id,
        command,
        status,
        createdAt: new Date().toLocaleTimeString(),
      },
    ],
  }));
  return id;
}

function finishCommand(
  set: RepositorySet,
  id: number,
  status: "success" | "error",
  message?: string,
) {
  set((state) => ({
    commandLogs: state.commandLogs.map((entry) => entry.id === id ? { ...entry, status, message } : entry),
  }));
}

function setErrorState(set: RepositorySet, message: string) {
  set({ error: message });
  setToast(set, "error", message);
}

function setToast(set: RepositorySet, type: ToastState["type"], message: string) {
  set({
    toast: {
      id: Date.now(),
      type,
      message,
    },
  });
}

function getBranchHeadHash(snapshot: RepositorySnapshot) {
  if (!snapshot.activeBranch) {
    return snapshot.commits[0]?.hash ?? "";
  }

  return snapshot.commits.find((commit) => commit.refs.includes(snapshot.activeBranch))?.hash
    ?? snapshot.commits[0]?.hash
    ?? "";
}

function countPulledCommits(commits: CommitNode[], beforeHead: string, afterHead: string) {
  if (!afterHead || beforeHead === afterHead) {
    return 0;
  }

  const beforeIndex = beforeHead ? commits.findIndex((commit) => commit.hash === beforeHead) : -1;
  if (beforeIndex > 0) {
    return beforeIndex;
  }

  return afterHead ? 1 : 0;
}

function getError(error: unknown): string {
  if (error instanceof Error) {
    const parsed = tryParseJsonError(error.message);
    const message = typeof parsed?.message === "string" ? parsed.message : error.message;
    return normalizeErrorMessage(message);
  }
  return "Unexpected operation failure";
}

function normalizeErrorMessage(message: string) {
  if (
    message.includes("Selected folder is not a Git repository")
    || message.includes("git non inizializzato")
  ) {
    return "git non inizializzato";
  }

  return message;
}

function parseCheckoutBlockedError(error: unknown, branch?: string): CheckoutBlockedError | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const parsed = tryParseJsonError(error.message);
  if (parsed?.type === "checkout-blocked") {
    return {
      type: "checkout-blocked",
      branch: typeof parsed.branch === "string" ? parsed.branch : branch ?? "",
      files: Array.isArray(parsed.files)
        ? parsed.files.filter((file): file is string => typeof file === "string")
        : [],
      message:
        typeof parsed.message === "string"
          ? parsed.message
          : "Checkout blocked by local changes that would be overwritten."
    };
  }

  const message = error.message;
  if (message.includes("Your local changes to the following files would be overwritten by checkout")) {
    return {
      type: "checkout-blocked",
      branch: branch ?? "",
      files: parseCheckoutBlockedFiles(message),
      message: "Checkout blocked by local changes that would be overwritten."
    };
  }

  return null;
}

function tryParseJsonError(message: string): Record<string, unknown> | null {
  const direct = parseJsonObject(message);
  if (direct) {
    return direct;
  }

  const start = message.indexOf("{");
  const end = message.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return parseJsonObject(message.slice(start, end + 1));
  }

  return null;
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function parseCheckoutBlockedFiles(message: string): string[] {
  const marker = "Your local changes to the following files would be overwritten by checkout:";
  const start = message.indexOf(marker);
  if (start === -1) {
    return [];
  }

  const afterMarker = message.slice(start + marker.length);
  const end = afterMarker.indexOf("Please commit your changes or stash them before you switch branches.");
  const filesBlock = end === -1 ? afterMarker : afterMarker.slice(0, end);
  return filesBlock
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function getDesktopApi() {
  if (!window.gitCoso) {
    throw new Error("Desktop bridge unavailable. Launch GitCoso with `npm run dev` and use the Electron window, not the browser tab.");
  }

  return window.gitCoso;
}
