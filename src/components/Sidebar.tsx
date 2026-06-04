import { useState, type MouseEvent } from "react";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  GitBranch,
  HardDrive,
  PanelLeftClose,
  PanelLeftOpen,
  RadioTower,
  Archive,
  Tag,
} from "lucide-react";
import { repoPathLabel } from "../lib/utils";
import { buildBranchContext } from "../lib/branchContextActions";
import { useRepositoryStore } from "../store/repositoryStore";
import { useSettingsStore } from "../store/settingsStore";
import { branchHiddenKey, useBranchVisibilityStore } from "../store/branchVisibilityStore";
import { cn } from "../lib/utils";
import type { Branch, BranchKind } from "../shared/types";
import type { BranchContextMenuState } from "./BranchContextMenu";

type SidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenBranchContextMenu: (state: BranchContextMenuState) => void;
};

export function Sidebar({ collapsed, onToggleCollapsed, onOpenBranchContextMenu }: SidebarProps) {
  const { snapshot, checkoutBranch, checkoutRemoteBranch, loading } = useRepositoryStore();
  const t = useSettingsStore().t;
  const { hiddenBranches, pinnedBranches, setBranchHidden, setFocusedBranch } = useBranchVisibilityStore();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<BranchKind, boolean>>({
    local: false,
    remote: false
  });
  const repoKey = snapshot.path ?? "no-repository";
  const localBranches = getStableBranchList(snapshot.branches, "local", repoKey, pinnedBranches);
  const remoteBranches = getStableBranchList(snapshot.branches, "remote", repoKey, pinnedBranches);

  function openBranchContextMenu(event: MouseEvent, branch: Branch) {
    event.preventDefault();
    const context = buildBranchContext(snapshot, branch.name, branch.kind, branch.lastCommit);
    if (!context) return;
    onOpenBranchContextMenu({
      x: event.clientX,
      y: event.clientY,
      context,
    });
  }

  function toggleCollapsed(kind: BranchKind) {
    setCollapsedGroups((current) => ({ ...current, [kind]: !current[kind] }));
  }

  const localVisibleCount = countVisibleBranches(repoKey, "local", localBranches, hiddenBranches);
  const remoteVisibleCount = countVisibleBranches(repoKey, "remote", remoteBranches, hiddenBranches);

  if (collapsed) {
    return (
      <aside className="min-h-0 border-r border-white/[0.08] bg-surface-900/86 px-2 py-3">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="mb-3 grid h-8 w-8 place-items-center rounded-md text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-100"
          title={t("sidebar.expand")}
        >
          <PanelLeftOpen size={15} />
        </button>
        <RailItem icon={HardDrive} label={snapshot.name} active={Boolean(snapshot.path)} />
        <RailItem icon={GitBranch} label={`${localVisibleCount} ${t("sidebar.localBranches")}`} />
        <RailItem icon={RadioTower} label={`${remoteVisibleCount} ${t("sidebar.remoteBranches")}`} />
        <RailItem icon={Archive} label={`0 ${t("sidebar.stashes")}`} />
        <RailItem icon={Tag} label={`0 ${t("sidebar.tags")}`} />
      </aside>
    );
  }

  return (
    <aside className="min-h-0 overflow-y-auto bg-surface-900/86 px-3 py-3">
      <div className="mb-3 rounded-md border border-white/10 bg-white/[0.04] p-2.5">
        <div className="mb-1.5 flex items-center gap-2 text-slate-300">
          <HardDrive size={15} className="text-accent-blue" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{snapshot.name}</span>
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="grid h-6 w-6 place-items-center rounded text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200"
            title={t("sidebar.collapse")}
          >
            <PanelLeftClose size={14} />
          </button>
        </div>
        <p className="break-all text-[11px] leading-4 text-slate-500">{repoPathLabel(snapshot.path)}</p>
        <span className="mt-2 inline-flex rounded border border-accent-blue/30 bg-accent-blue/10 px-1.5 py-0.5 text-[10px] text-sky-200">
          {snapshot.path ? t("sidebar.liveRepository") : t("sidebar.noFolder")}
        </span>
      </div>

      <BranchGroup
        title={t("sidebar.localBranches")}
        icon={GitBranch}
        kind="local"
        repoKey={repoKey}
        branches={localBranches}
        activeBranch={snapshot.activeBranch}
        collapsed={collapsedGroups.local}
        hiddenBranches={hiddenBranches}
        disabled={loading || !snapshot.path}
        onToggleCollapsed={() => toggleCollapsed("local")}
        onSetHidden={(kind, name, hidden) => setBranchHidden(repoKey, kind, name, hidden)}
        onFocusBranch={setFocusedBranch}
        onCheckout={checkoutBranch}
        onCheckoutRemote={checkoutRemoteBranch}
        onOpenContextMenu={openBranchContextMenu}
      />
      <BranchGroup
        title={t("sidebar.remoteBranches")}
        icon={RadioTower}
        kind="remote"
        repoKey={repoKey}
        branches={remoteBranches}
        activeBranch={snapshot.activeBranch}
        collapsed={collapsedGroups.remote}
        hiddenBranches={hiddenBranches}
        disabled
        onToggleCollapsed={() => toggleCollapsed("remote")}
        onSetHidden={(kind, name, hidden) => setBranchHidden(repoKey, kind, name, hidden)}
        onFocusBranch={setFocusedBranch}
        onCheckout={checkoutBranch}
        onCheckoutRemote={checkoutRemoteBranch}
        onOpenContextMenu={openBranchContextMenu}
      />
      <EmptyMetaGroup title={t("sidebar.stashes")} icon={Archive} count={0} />
      <EmptyMetaGroup title={t("sidebar.tags")} icon={Tag} count={0} />
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
  onFocusBranch: (name: string | null) => void;
  onCheckout: (branch: string) => Promise<void>;
  onCheckoutRemote: (remoteBranch: string) => Promise<void>;
  onOpenContextMenu: (event: MouseEvent, branch: Branch) => void;
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
  onFocusBranch,
  onCheckout,
  onCheckoutRemote,
  onOpenContextMenu
}: BranchGroupProps) {
  const visibleBranches = branches.filter((branch) => !hiddenBranches.has(branchHiddenKey(repoKey, kind, branch.name)));
  const CountIcon = collapsed ? ChevronRight : ChevronDown;
  const t = useSettingsStore().t;

  return (
    <section className="mt-3">
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="mb-1 flex h-6 w-full items-center gap-1.5 rounded px-1 text-left text-[10px] font-semibold uppercase text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-300"
      >
        <CountIcon size={12} />
        <Icon size={12} />
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <span className="rounded bg-white/[0.06] px-1 py-0.5 text-[10px] text-slate-500">
          {visibleBranches.length}
        </span>
      </button>

      {!collapsed ? (
        <div className="space-y-0.5">
          {branches.length === 0 ? (
            <p className="rounded border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[11px] text-slate-500">
              {t("sidebar.openToLoad")}
            </p>
          ) : null}

          {branches.map((branch) => {
            const hidden = hiddenBranches.has(branchHiddenKey(repoKey, kind, branch.name));
            return hidden ? (
                <HiddenBranchRow
                  key={branch.name}
                  branch={branch}
                  onShow={() => onSetHidden(kind, branch.name, false)}
                  onFocus={() => onFocusBranch(branch.name)}
                  onBlur={() => onFocusBranch(null)}
                  onContextMenu={(event) => onOpenContextMenu(event, branch)}
                />
              ) : (
                <BranchRow
                  key={branch.name}
                  branch={branch}
                  activeBranch={activeBranch}
                  disabled={disabled}
                  onCheckout={onCheckout}
                  onDoubleClick={kind === "remote" ? () => onCheckoutRemote(branch.name) : undefined}
                  onHide={() => onSetHidden(kind, branch.name, true)}
                  onFocus={() => onFocusBranch(branch.name)}
                  onBlur={() => onFocusBranch(null)}
                  onContextMenu={(event) => onOpenContextMenu(event, branch)}
                />
              );
          })}
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
  onDoubleClick?: () => void;
  onHide: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onContextMenu: (event: MouseEvent) => void;
};

function BranchRow({ branch, activeBranch, disabled, onCheckout, onDoubleClick, onHide, onFocus, onBlur, onContextMenu }: BranchRowProps) {
  const t = useSettingsStore().t;
  const active = branch.current || branch.name === activeBranch;
  const canCheckout = !disabled && !active;
  const remoteDoubleClickOnly = Boolean(onDoubleClick);

  return (
    <div
      onMouseEnter={onFocus}
      onMouseLeave={onBlur}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className={cn(
        "group relative grid h-6 grid-cols-[minmax(0,1fr)_22px] items-center gap-1 rounded px-1.5 transition",
        active ? "bg-cyan-400/12 text-cyan-100" : "text-slate-400 hover:bg-white/[0.045] hover:text-slate-100",
        disabled && "opacity-75"
      )}
    >
      {active ? <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-cyan-300" /> : null}
      <button
        type="button"
        disabled={!canCheckout && !remoteDoubleClickOnly}
        onClick={() => {
          if (canCheckout) {
            void onCheckout(branch.name);
          }
        }}
        className="min-w-0 text-left disabled:cursor-default"
        title={onDoubleClick ? `${branch.name} - double click to create local tracking branch` : branch.name}
      >
        <span className="flex min-w-0 items-center gap-1.5 pl-1">
          <GitBranch size={11} className={cn("shrink-0", active ? "text-cyan-300" : "text-slate-600")} />
          <span className="truncate text-[11px]">{branch.name}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={onHide}
        className="grid h-5 w-5 place-items-center rounded text-slate-600 opacity-0 transition hover:bg-white/[0.08] hover:text-slate-300 group-hover:opacity-100"
        title={t("branch.hide")}
      >
        <EyeOff size={12} />
      </button>
    </div>
  );
}

type HiddenBranchRowProps = {
  branch: Branch;
  onShow: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onContextMenu: (event: MouseEvent) => void;
};

function HiddenBranchRow({ branch, onShow, onFocus, onBlur, onContextMenu }: HiddenBranchRowProps) {
  const t = useSettingsStore().t;
  return (
    <div
      onMouseEnter={onFocus}
      onMouseLeave={onBlur}
      onContextMenu={onContextMenu}
      className="group grid h-6 grid-cols-[minmax(0,1fr)_22px] items-center gap-1 rounded px-1.5 text-slate-600 transition hover:bg-white/[0.035]"
    >
      <span className="flex min-w-0 items-center gap-1.5 truncate text-[11px] line-through decoration-slate-600/70" title={branch.name}>
        <GitBranch size={11} className="shrink-0 text-slate-700" />
        {branch.name}
      </span>
      <button
        type="button"
        onClick={onShow}
        className="grid h-5 w-5 place-items-center rounded text-slate-600 transition hover:bg-white/[0.08] hover:text-slate-300"
        title={t("branch.show")}
      >
        <Eye size={12} />
      </button>
    </div>
  );
}

type RailItemProps = {
  icon: typeof GitBranch;
  label: string;
  active?: boolean;
};

function RailItem({ icon: Icon, label, active }: RailItemProps) {
  return (
    <div
      className={cn(
        "mb-2 grid h-8 w-8 place-items-center rounded-md text-slate-500",
        active ? "bg-accent-blue/10 text-sky-300" : "bg-white/[0.03]"
      )}
      title={label}
    >
      <Icon size={15} />
    </div>
  );
}

type EmptyMetaGroupProps = {
  title: string;
  icon: typeof GitBranch;
  count: number;
};

function EmptyMetaGroup({ title, icon: Icon, count }: EmptyMetaGroupProps) {
  const [collapsed, setCollapsed] = useState(true);
  const t = useSettingsStore().t;
  const CountIcon = collapsed ? ChevronRight : ChevronDown;

  return (
    <section className="mt-3">
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className="mb-1 flex h-6 w-full items-center gap-1.5 rounded px-1 text-left text-[10px] font-semibold uppercase text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-300"
      >
        <CountIcon size={12} />
        <Icon size={12} />
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <span className="rounded bg-white/[0.06] px-1 py-0.5 text-[10px] text-slate-500">{count}</span>
      </button>
      {!collapsed ? (
        <p className="rounded border border-white/10 bg-white/[0.025] px-2 py-1.5 text-[11px] text-slate-600">
          {t("sidebar.noItems")}
        </p>
      ) : null}
    </section>
  );
}

function countVisibleBranches(repoKey: string, kind: BranchKind, branches: Branch[], hiddenBranches: Set<string>) {
  return branches.filter((branch) => !hiddenBranches.has(branchHiddenKey(repoKey, kind, branch.name))).length;
}

function getStableBranchList(branches: Branch[], kind: BranchKind, repoKey: string, pinnedBranches: Set<string>) {
  return branches
    .filter((branch) => branch.kind === kind)
    .sort((a, b) => {
      const aPinned = pinnedBranches.has(branchHiddenKey(repoKey, kind, a.name));
      const bPinned = pinnedBranches.has(branchHiddenKey(repoKey, kind, b.name));
      return Number(bPinned) - Number(aPinned) || a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
}
