import { useState } from "react";
import { ChevronDown, ChevronRight, Eye, EyeOff, GitBranch, HardDrive, RadioTower } from "lucide-react";
import { repoPathLabel } from "../lib/utils";
import { useRepositoryStore } from "../store/repositoryStore";
import { cn } from "../lib/utils";
import type { Branch, BranchKind } from "../shared/types";

const hiddenBranchesStorageKey = "branchflow.hiddenBranches";

export function Sidebar() {
  const { snapshot, checkoutBranch, loading } = useRepositoryStore();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<BranchKind, boolean>>({
    local: false,
    remote: false
  });
  const [hiddenBranches, setHiddenBranches] = useState<Set<string>>(() => readHiddenBranches());
  const localBranches = snapshot.branches.filter((branch) => branch.kind === "local");
  const remoteBranches = snapshot.branches.filter((branch) => branch.kind === "remote");
  const repoKey = snapshot.path ?? "no-repository";

  function toggleCollapsed(kind: BranchKind) {
    setCollapsedGroups((current) => ({ ...current, [kind]: !current[kind] }));
  }

  function setBranchHidden(kind: BranchKind, name: string, hidden: boolean) {
    const key = branchHiddenKey(repoKey, kind, name);
    setHiddenBranches((current) => {
      const next = new Set(current);
      if (hidden) {
        next.add(key);
      } else {
        next.delete(key);
      }
      writeHiddenBranches(next);
      return next;
    });
  }

  return (
    <aside className="min-h-0 bg-surface-900/86 p-4">
      <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
        <div className="mb-2 flex items-center gap-2 text-slate-300">
          <HardDrive size={15} className="text-accent-blue" />
          <span className="text-sm font-semibold">{snapshot.name}</span>
        </div>
        <p className="break-all text-xs leading-5 text-slate-500">{repoPathLabel(snapshot.path)}</p>
        <span className="mt-2 inline-flex rounded-md border border-accent-blue/30 bg-accent-blue/10 px-2 py-0.5 text-[11px] text-sky-200">
          {snapshot.path ? "Live Git repository" : "No folder selected"}
        </span>
      </div>

      <BranchGroup
        title="Local branches"
        icon={GitBranch}
        kind="local"
        repoKey={repoKey}
        branches={localBranches}
        activeBranch={snapshot.activeBranch}
        collapsed={collapsedGroups.local}
        hiddenBranches={hiddenBranches}
        disabled={loading || !snapshot.path}
        onToggleCollapsed={() => toggleCollapsed("local")}
        onSetHidden={setBranchHidden}
        onCheckout={checkoutBranch}
      />
      <BranchGroup
        title="Remote branches"
        icon={RadioTower}
        kind="remote"
        repoKey={repoKey}
        branches={remoteBranches}
        activeBranch={snapshot.activeBranch}
        collapsed={collapsedGroups.remote}
        hiddenBranches={hiddenBranches}
        disabled
        onToggleCollapsed={() => toggleCollapsed("remote")}
        onSetHidden={setBranchHidden}
        onCheckout={checkoutBranch}
      />
    </aside>
  );
}

type BranchGroupProps = {
  title: string;
  icon: typeof GitBranch;
  kind: BranchKind;
  repoKey: string;
  branches: Branch[];
  activeBranch: string;
  collapsed: boolean;
  hiddenBranches: Set<string>;
  disabled?: boolean;
  onToggleCollapsed: () => void;
  onSetHidden: (kind: BranchKind, name: string, hidden: boolean) => void;
  onCheckout: (branch: string) => Promise<void>;
};

function BranchGroup({
  title,
  icon: Icon,
  kind,
  repoKey,
  branches,
  activeBranch,
  collapsed,
  hiddenBranches,
  disabled,
  onToggleCollapsed,
  onSetHidden,
  onCheckout
}: BranchGroupProps) {
  const visibleBranches = branches.filter((branch) => !hiddenBranches.has(branchHiddenKey(repoKey, kind, branch.name)));
  const hiddenBranchList = branches.filter((branch) => hiddenBranches.has(branchHiddenKey(repoKey, kind, branch.name)));
  const CountIcon = collapsed ? ChevronRight : ChevronDown;

  return (
    <section className="mt-4">
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="mb-1 flex h-7 w-full items-center gap-2 rounded-md px-1.5 text-left text-[11px] font-semibold uppercase text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-300"
      >
        <CountIcon size={13} />
        <Icon size={13} />
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-500">
          {visibleBranches.length}
        </span>
      </button>

      {!collapsed ? (
        <div className="space-y-0.5">
          {branches.length === 0 ? (
            <p className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-xs text-slate-500">
            Open a repository to load branches.
            </p>
          ) : null}

          {visibleBranches.map((branch) => (
            <BranchRow
              key={branch.name}
              branch={branch}
              activeBranch={activeBranch}
              disabled={disabled}
              onCheckout={onCheckout}
              onHide={() => onSetHidden(kind, branch.name, true)}
            />
          ))}

          {hiddenBranchList.length > 0 ? (
            <div className="mt-2 border-t border-white/8 pt-1">
              {hiddenBranchList.map((branch) => (
                <HiddenBranchRow
                  key={branch.name}
                  branch={branch}
                  onShow={() => onSetHidden(kind, branch.name, false)}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

type BranchRowProps = {
  branch: Branch;
  activeBranch: string;
  disabled?: boolean;
  onCheckout: (branch: string) => Promise<void>;
  onHide: () => void;
};

function BranchRow({ branch, activeBranch, disabled, onCheckout, onHide }: BranchRowProps) {
  const active = branch.current || branch.name === activeBranch;

  return (
    <div
      className={cn(
        "group grid h-8 grid-cols-[minmax(0,1fr)_24px] items-center gap-1 rounded-md px-1.5 transition",
        active ? "bg-accent-violet/14 text-violet-100" : "text-slate-400 hover:bg-white/[0.045] hover:text-slate-100",
        disabled && "opacity-75"
      )}
    >
      <button
        type="button"
        disabled={disabled || active}
        onClick={() => onCheckout(branch.name)}
        className="min-w-0 text-left disabled:cursor-default"
        title={branch.name}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {active ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-green" /> : null}
          <span className="truncate text-xs">{branch.name}</span>
        </span>
        {branch.lastCommit ? (
          <span className="block truncate pl-3 font-mono text-[10px] text-slate-600">{branch.lastCommit}</span>
        ) : null}
      </button>
      <button
        type="button"
        onClick={onHide}
        className="grid h-6 w-6 place-items-center rounded text-slate-600 opacity-0 transition hover:bg-white/[0.08] hover:text-slate-300 group-hover:opacity-100"
        title="Hide branch"
      >
        <EyeOff size={13} />
      </button>
    </div>
  );
}

type HiddenBranchRowProps = {
  branch: Branch;
  onShow: () => void;
};

function HiddenBranchRow({ branch, onShow }: HiddenBranchRowProps) {
  return (
    <div className="group grid h-7 grid-cols-[minmax(0,1fr)_24px] items-center gap-1 rounded-md px-1.5 text-slate-600 transition hover:bg-white/[0.035]">
      <span className="truncate text-xs line-through decoration-slate-600/70" title={branch.name}>
        {branch.name}
      </span>
      <button
        type="button"
        onClick={onShow}
        className="grid h-6 w-6 place-items-center rounded text-slate-600 transition hover:bg-white/[0.08] hover:text-slate-300"
        title="Show branch"
      >
        <Eye size={13} />
      </button>
    </div>
  );
}

function branchHiddenKey(repoKey: string, kind: BranchKind, name: string) {
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
