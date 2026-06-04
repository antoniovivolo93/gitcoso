import { create } from "zustand";
import type { BranchKind } from "../shared/types";

const hiddenBranchesStorageKey = "gitcoso.hiddenBranches";
const pinnedBranchesStorageKey = "gitcoso.pinnedBranches";
const soloBranchesStorageKey = "gitcoso.soloBranches";

type BranchVisibilityState = {
  hiddenBranches: Set<string>;
  pinnedBranches: Set<string>;
  soloBranches: Set<string>;
  focusedBranch: string | null;
  setBranchHidden: (repoKey: string, kind: BranchKind, name: string, hidden: boolean) => void;
  setBranchPinned: (repoKey: string, kind: BranchKind, name: string, pinned: boolean) => void;
  setBranchSolo: (repoKey: string, kind: BranchKind, name: string, solo: boolean) => void;
  setFocusedBranch: (name: string | null) => void;
  isBranchHidden: (repoKey: string, kind: BranchKind, name: string) => boolean;
  isBranchPinned: (repoKey: string, kind: BranchKind, name: string) => boolean;
};

export const useBranchVisibilityStore = create<BranchVisibilityState>((set, get) => ({
  hiddenBranches: readHiddenBranches(),
  pinnedBranches: readStringSet(pinnedBranchesStorageKey),
  soloBranches: readStringSet(soloBranchesStorageKey),
  focusedBranch: null,

  setBranchHidden: (repoKey, kind, name, hidden) => {
    const key = branchHiddenKey(repoKey, kind, name);
    set((current) => {
      const next = new Set(current.hiddenBranches);
      if (hidden) {
        next.add(key);
      } else {
        next.delete(key);
      }
      writeHiddenBranches(next);
      return { hiddenBranches: next };
    });
  },

  setBranchPinned: (repoKey, kind, name, pinned) => {
    const key = branchHiddenKey(repoKey, kind, name);
    set((current) => {
      const next = new Set(current.pinnedBranches);
      if (pinned) {
        next.add(key);
      } else {
        next.delete(key);
      }
      writeStringSet(pinnedBranchesStorageKey, next);
      return { pinnedBranches: next };
    });
  },

  setBranchSolo: (repoKey, kind, name, solo) => {
    const key = branchHiddenKey(repoKey, kind, name);
    set((current) => {
      const next = new Set(current.soloBranches);
      if (solo) {
        next.add(key);
      } else {
        next.delete(key);
      }
      writeStringSet(soloBranchesStorageKey, next);
      return { soloBranches: next };
    });
  },

  setFocusedBranch: (focusedBranch) => {
    set({ focusedBranch });
  },

  isBranchHidden: (repoKey, kind, name) => {
    return get().hiddenBranches.has(branchHiddenKey(repoKey, kind, name));
  },

  isBranchPinned: (repoKey, kind, name) => {
    return get().pinnedBranches.has(branchHiddenKey(repoKey, kind, name));
  },
}));

export function branchHiddenKey(repoKey: string, kind: BranchKind, name: string) {
  return `${repoKey}::${kind}::${name}`;
}

function readHiddenBranches() {
  return readStringSet(hiddenBranchesStorageKey);
}

function readStringSet(key: string) {
  try {
    const value = window.localStorage.getItem(key);
    const branches = value ? JSON.parse(value) : [];
    return new Set(Array.isArray(branches) ? branches.filter((branch) => typeof branch === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function writeHiddenBranches(branches: Set<string>) {
  writeStringSet(hiddenBranchesStorageKey, branches);
}

function writeStringSet(key: string, branches: Set<string>) {
  window.localStorage.setItem(key, JSON.stringify([...branches]));
}
