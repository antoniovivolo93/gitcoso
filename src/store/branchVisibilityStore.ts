import { create } from "zustand";
import type { BranchKind } from "../shared/types";

const hiddenBranchesStorageKey = "gitcoso.hiddenBranches";

type BranchVisibilityState = {
  hiddenBranches: Set<string>;
  focusedBranch: string | null;
  setBranchHidden: (repoKey: string, kind: BranchKind, name: string, hidden: boolean) => void;
  setFocusedBranch: (name: string | null) => void;
  isBranchHidden: (repoKey: string, kind: BranchKind, name: string) => boolean;
};

export const useBranchVisibilityStore = create<BranchVisibilityState>((set, get) => ({
  hiddenBranches: readHiddenBranches(),
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

  setFocusedBranch: (focusedBranch) => {
    set({ focusedBranch });
  },

  isBranchHidden: (repoKey, kind, name) => {
    return get().hiddenBranches.has(branchHiddenKey(repoKey, kind, name));
  },
}));

export function branchHiddenKey(repoKey: string, kind: BranchKind, name: string) {
  return `${repoKey}::${kind}::${name}`;
}

function readHiddenBranches() {
  try {
    const value = window.localStorage.getItem(hiddenBranchesStorageKey);
    const branches = value ? JSON.parse(value) : [];
    return new Set(Array.isArray(branches) ? branches.filter((branch) => typeof branch === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function writeHiddenBranches(branches: Set<string>) {
  window.localStorage.setItem(hiddenBranchesStorageKey, JSON.stringify([...branches]));
}
