import { create } from "zustand";
import type { CheckoutBlockedError, CommitDetails, RepositorySnapshot } from "../shared/types";
import { emptySnapshot } from "../shared/initialState";

type RepositoryState = {
  snapshot: RepositorySnapshot;
  selectedHash: string;
  selectedDetails: CommitDetails | null;
  loading: boolean;
  error: string | null;
  checkoutBlocked: CheckoutBlockedError | null;
  desktopReady: boolean;
  syncDesktopBridge: () => void;
  clearCheckoutBlocked: () => void;
  setSelectedCommit: (hash: string) => Promise<void>;
  openRepository: () => Promise<void>;
  refresh: () => Promise<void>;
  checkoutBranch: (branch: string) => Promise<void>;
  stashAndCheckout: () => Promise<void>;
  createBranch: (name: string, checkout: boolean) => Promise<void>;
  commit: (message: string) => Promise<void>;
  fetch: () => Promise<void>;
  pull: () => Promise<void>;
  push: () => Promise<void>;
};

export const useRepositoryStore = create<RepositoryState>((set, get) => ({
  snapshot: emptySnapshot,
  selectedHash: "",
  selectedDetails: null,
  loading: false,
  error: null,
  checkoutBlocked: null,
  desktopReady: Boolean(window.branchFlow),

  syncDesktopBridge: () => {
    set({ desktopReady: Boolean(window.branchFlow) });
  },

  clearCheckoutBlocked: () => {
    set({ checkoutBlocked: null });
  },

  setSelectedCommit: async (hash) => {
    const { snapshot } = get();
    set({ selectedHash: hash, loading: true, error: null });
    try {
      const selectedDetails = await getDesktopApi().getCommitDetails(snapshot.path, hash);
      set({ selectedDetails });
    } catch (error) {
      set({ error: getError(error) });
    } finally {
      set({ loading: false });
    }
  },

  openRepository: async () => {
    await runSnapshotAction(set, async () => getDesktopApi().openRepository());
  },

  refresh: async () => {
    const { snapshot } = get();
    if (!snapshot.path) return;
    await runSnapshotAction(set, async () => getDesktopApi().refreshRepository(snapshot.path!));
  },

  checkoutBranch: async (branch) => {
    const { snapshot } = get();
    if (!snapshot.path) return;
    await runSnapshotAction(set, async () => getDesktopApi().checkoutBranch(snapshot.path!, branch), branch);
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
      }
    );
  },

  createBranch: async (name, checkout) => {
    const { snapshot } = get();
    if (!snapshot.path) return;
    await runSnapshotAction(set, async () => getDesktopApi().createBranch(snapshot.path!, name, checkout));
  },

  commit: async (message) => {
    const { snapshot } = get();
    if (!snapshot.path) return;
    await runSnapshotAction(set, async () => getDesktopApi().commit(snapshot.path!, message));
  },

  fetch: async () => {
    const { snapshot } = get();
    if (!snapshot.path) return;
    await runSnapshotAction(set, async () => getDesktopApi().fetch(snapshot.path!));
  },

  pull: async () => {
    const { snapshot } = get();
    if (!snapshot.path) return;
    await runSnapshotAction(set, async () => getDesktopApi().pull(snapshot.path!));
  },

  push: async () => {
    const { snapshot } = get();
    if (!snapshot.path) return;
    await runSnapshotAction(set, async () => getDesktopApi().push(snapshot.path!));
  }
}));

async function runSnapshotAction(
  set: (partial: Partial<RepositoryState>) => void,
  action: () => Promise<RepositorySnapshot>,
  checkoutBranch?: string
) {
  set({ loading: true, error: null });
  try {
    const snapshot = await action();
    const selectedHash = snapshot.commits[0]?.hash ?? "";
    const selectedDetails = selectedHash
      ? await getDesktopApi().getCommitDetails(snapshot.path, selectedHash)
      : null;
    set({ snapshot, selectedHash, selectedDetails, checkoutBlocked: null });
  } catch (error) {
    const checkoutBlocked = parseCheckoutBlockedError(error, checkoutBranch);
    if (checkoutBlocked) {
      set({ checkoutBlocked, error: null });
    } else {
      set({ error: getError(error) });
    }
  } finally {
    set({ loading: false });
  }
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
