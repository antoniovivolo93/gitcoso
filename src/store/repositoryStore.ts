import { create } from "zustand";
import type { CheckoutBlockedError, CommitDetails, CommitNode, RepositorySnapshot } from "../shared/types";
import { emptySnapshot } from "../shared/initialState";

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
  clearCommandLogs: () => void;
  clearCheckoutBlocked: () => void;
  setSelectedCommit: (hash: string) => Promise<void>;
  openRepository: () => Promise<void>;
  refresh: () => Promise<void>;
  checkoutBranch: (branch: string) => Promise<void>;
  checkoutRemoteBranch: (remoteBranch: string) => Promise<void>;
  stashAndCheckout: () => Promise<void>;
  createBranch: (name: string, checkout: boolean) => Promise<void>;
  commit: (message: string) => Promise<void>;
  fetch: () => Promise<void>;
  pull: () => Promise<void>;
  push: () => Promise<void>;
};

type RepositorySet = (
  partial: Partial<RepositoryState> | ((state: RepositoryState) => Partial<RepositoryState>),
) => void;

export const useRepositoryStore = create<RepositoryState>((set, get) => ({
  snapshot: emptySnapshot,
  selectedHash: "",
  selectedDetails: null,
  loading: false,
  error: null,
  toast: null,
  commandLogs: [],
  checkoutBlocked: null,
  desktopReady: Boolean(window.branchFlow),

  syncDesktopBridge: () => {
    set({ desktopReady: Boolean(window.branchFlow) });
  },

  clearToast: () => {
    set({ toast: null });
  },

  clearCommandLogs: () => {
    set({ commandLogs: [] });
  },

  clearCheckoutBlocked: () => {
    set({ checkoutBlocked: null });
  },

  setSelectedCommit: async (hash) => {
    const { snapshot } = get();
    const commandId = startCommand(set, `git show ${hash.slice(0, 7)}`);
    set({ selectedHash: hash, loading: true, error: null });
    try {
      const selectedDetails = await getDesktopApi().getCommitDetails(snapshot.path, hash);
      set({ selectedDetails });
      finishCommand(set, commandId, "success");
    } catch (error) {
      const message = getError(error);
      setErrorState(set, message);
      finishCommand(set, commandId, "error", message);
    } finally {
      set({ loading: false });
    }
  },

  openRepository: async () => {
    await runSnapshotAction(set, async () => getDesktopApi().openRepository(), undefined, "open repository");
  },

  refresh: async () => {
    const { snapshot } = get();
    if (!snapshot.path) return;
    await runSnapshotAction(set, async () => getDesktopApi().refreshRepository(snapshot.path!), undefined, "git branch -a && git log --all && git status");
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
      throw new Error("Desktop bridge is out of date. Close BranchFlow completely and restart it with npm run dev.");
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
          throw new Error("Desktop bridge is out of date. Close BranchFlow completely and restart it with npm run dev.");
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
        type: pulledCount > 0 ? "success" : "info",
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
  command?: string
): Promise<RepositorySnapshot | null> {
  const commandId = command ? startCommand(set, command) : null;
  set({ loading: true, error: null });
  try {
    const snapshot = await action();
    const selectedHash = snapshot.commits[0]?.hash ?? "";
    const selectedDetails = selectedHash
      ? await getDesktopApi().getCommitDetails(snapshot.path, selectedHash)
      : null;
    set({ snapshot, selectedHash, selectedDetails, checkoutBlocked: null });
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
    return typeof parsed?.message === "string" ? parsed.message : error.message;
  }
  return "Unexpected operation failure";
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
  if (!window.branchFlow) {
    throw new Error("Desktop bridge unavailable. Launch BranchFlow with `npm run dev` and use the Electron window, not the browser tab.");
  }

  return window.branchFlow;
}
