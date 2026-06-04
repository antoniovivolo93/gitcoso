import { useMemo, useState } from "react";
import { ArrowDownAZ, ArrowUpZA, GitBranch, ListTree, Rows3, X } from "lucide-react";
import type { ChangedFile, CommitOptions } from "../../shared/types";
import { cn } from "../../lib/utils";
import { useRepositoryStore } from "../../store/repositoryStore";
import { CommitForm } from "./CommitForm";
import { FileChangesSection } from "./FileChangesSection";

const defaultCommitOptions: CommitOptions = {
  signOff: false,
  allowEmpty: false,
  noVerify: false,
  author: "",
  date: "",
};

export function ChangesPanel() {
  const {
    snapshot,
    loading,
    stageFile,
    stageFolder,
    stageAll,
    unstageFile,
    unstageFolder,
    unstageAll,
    discardFile,
    commitAdvanced,
    openFile,
  } = useRepositoryStore();
  const [viewMode, setViewMode] = useState<"path" | "tree">("tree");
  const [sortMode, setSortMode] = useState<"az" | "za">("az");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState({ unstaged: true, staged: true });
  const [commitSummary, setCommitSummary] = useState("");
  const [commitDescription, setCommitDescription] = useState("");
  const [amendPreviousCommit, setAmendPreviousCommit] = useState(false);
  const [commitOptions, setCommitOptions] = useState<CommitOptions>(defaultCommitOptions);
  const [optionsExpanded, setOptionsExpanded] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [diffPreview, setDiffPreview] = useState<{ path: string; staged: boolean; diff: string } | null>(null);

  const status = snapshot.workingDirectoryStatus;
  const currentBranch = snapshot.activeBranch || "detached HEAD";
  const stagedFiles = useMemo(() => sortFiles(status.stagedFiles, sortMode), [status.stagedFiles, sortMode]);
  const unstagedFiles = useMemo(() => sortFiles(status.unstagedFiles, sortMode), [status.unstagedFiles, sortMode]);
  const totalChangedFiles = countUniqueFiles(stagedFiles, unstagedFiles);
  const blockingReason = getBlockingReason(status);
  const currentBranchDetails = snapshot.branches.find((branch) => branch.current);
  const headCommit = snapshot.commits[0];
  const pushedWarning = Boolean(
    amendPreviousCommit
    && currentBranchDetails?.upstream
    && headCommit?.refs.includes(currentBranchDetails.upstream)
  );
  const canCommit = Boolean(
    snapshot.path
    && stagedFiles.length > 0
    && commitSummary.trim()
    && !blockingReason
  );

  const runAction = async (label: string, action: () => Promise<void>) => {
    setLoadingAction(label);
    setErrorMessage(null);
    try {
      await action();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Git operation failed.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDiscard = (filePath: string) => {
    if (!window.confirm(`Discard changes in ${filePath}? This cannot be undone.`)) return;
    void runAction("discard", () => discardFile(filePath));
  };

  const handleDiff = (filePath: string, staged: boolean) => {
    if (!snapshot.path) return;
    void runAction("diff", async () => {
      const diff = await window.gitCoso.getFileDiff(snapshot.path!, filePath, staged);
      setDiffPreview({ path: filePath, staged, diff });
    });
  };

  const resetCommitForm = () => {
    setCommitSummary("");
    setCommitDescription("");
    setAmendPreviousCommit(false);
    setCommitOptions(defaultCommitOptions);
    setOptionsExpanded(false);
    setDiffPreview(null);
  };

  const handleCreateCommit = async () => {
    await commitAdvanced(commitSummary, commitDescription, false, commitOptions);
    resetCommitForm();
  };

  const handleAmendCommit = async () => {
    await commitAdvanced(commitSummary, commitDescription, true, commitOptions);
    resetCommitForm();
  };

  const handleCommit = () => {
    void runAction("commit", async () => {
      if (amendPreviousCommit) {
        await handleAmendCommit();
      } else {
        await handleCreateCommit();
      }
    });
  };

  return (
    <aside className="flex min-h-0 flex-col border-l border-white/[0.08] bg-[#111722]">
      <header className="border-b border-white/[0.08] bg-[#0c111a]/95 p-3">
        <div className="flex min-w-0 items-start gap-2">
          <GitBranch size={16} className="mt-0.5 shrink-0 text-cyan-300" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-slate-50">
              {totalChangedFiles} file {totalChangedFiles === 1 ? "change" : "changes"} on {currentBranch}
            </h2>
            <p className="mt-1 truncate text-xs text-slate-500">{snapshot.path ?? "No repository selected"}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <SegmentedButton
            active={viewMode === "path"}
            onClick={() => setViewMode("path")}
            icon={Rows3}
            label="Path"
          />
          <SegmentedButton
            active={viewMode === "tree"}
            onClick={() => setViewMode("tree")}
            icon={ListTree}
            label="Tree"
          />
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setSortMode((value) => value === "az" ? "za" : "az")}
            className="flex h-8 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 text-xs text-slate-300 transition hover:bg-white/[0.08]"
            title={sortMode === "az" ? "Sort Z-A" : "Sort A-Z"}
          >
            {sortMode === "az" ? <ArrowDownAZ size={14} /> : <ArrowUpZA size={14} />}
            {sortMode === "az" ? "A-Z" : "Z-A"}
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
        {errorMessage ? (
          <div className="rounded-md border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs leading-5 text-rose-100">
            {errorMessage}
          </div>
        ) : null}

        <FileChangesSection
          title="Unstaged Files"
          mode="unstaged"
          files={unstagedFiles}
          viewMode={viewMode}
          expanded={expandedSections.unstaged}
          expandedFolders={expandedFolders}
          onToggleSection={() => setExpandedSections((value) => ({ ...value, unstaged: !value.unstaged }))}
          onToggleFolder={(folderPath) => toggleFolder(setExpandedFolders, folderPath)}
          onExpandAll={(folderPaths) => setExpandedFolders((value) => new Set([...value, ...folderPaths]))}
          onCollapseAll={(folderPaths) => setExpandedFolders((value) => {
            const next = new Set(value);
            folderPaths.forEach((folderPath) => next.delete(folderPath));
            return next;
          })}
          onStageFile={(filePath) => void runAction("stage", () => stageFile(filePath))}
          onStageFolder={(folderPath) => void runAction("stage-folder", () => stageFolder(folderPath))}
          onStageAll={() => void runAction("stage-all", stageAll)}
          onDiscard={handleDiscard}
          onDiff={handleDiff}
        />

        <FileChangesSection
          title="Staged Files"
          mode="staged"
          files={stagedFiles}
          viewMode={viewMode}
          expanded={expandedSections.staged}
          expandedFolders={expandedFolders}
          onToggleSection={() => setExpandedSections((value) => ({ ...value, staged: !value.staged }))}
          onToggleFolder={(folderPath) => toggleFolder(setExpandedFolders, folderPath)}
          onExpandAll={(folderPaths) => setExpandedFolders((value) => new Set([...value, ...folderPaths]))}
          onCollapseAll={(folderPaths) => setExpandedFolders((value) => {
            const next = new Set(value);
            folderPaths.forEach((folderPath) => next.delete(folderPath));
            return next;
          })}
          onUnstageFile={(filePath) => void runAction("unstage", () => unstageFile(filePath))}
          onUnstageFolder={(folderPath) => void runAction("unstage-folder", () => unstageFolder(folderPath))}
          onUnstageAll={() => void runAction("unstage-all", unstageAll)}
          onDiff={handleDiff}
          onOpenFile={(filePath) => void runAction("open-file", () => openFile(filePath))}
        />

        {diffPreview ? (
          <section className="rounded-md border border-white/[0.08] bg-[#0c111a]">
            <div className="flex h-9 items-center gap-2 border-b border-white/[0.06] px-3">
              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-300">
                {diffPreview.staged ? "Staged diff" : "Diff"}: {diffPreview.path}
              </span>
              <button
                type="button"
                onClick={() => setDiffPreview(null)}
                className="grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-white/[0.08] hover:text-slate-100"
                title="Close diff"
              >
                <X size={13} />
              </button>
            </div>
            <pre className="max-h-72 overflow-auto p-3 font-mono text-[11px] leading-5 text-slate-300">
              {diffPreview.diff.trim() || "No diff available."}
            </pre>
          </section>
        ) : null}
      </div>

      <CommitForm
        summary={commitSummary}
        description={commitDescription}
        amendPreviousCommit={amendPreviousCommit}
        commitOptions={commitOptions}
        optionsExpanded={optionsExpanded}
        canCommit={canCommit}
        blockingReason={blockingReason}
        pushedWarning={pushedWarning}
        loading={loading || Boolean(loadingAction)}
        onSummaryChange={setCommitSummary}
        onDescriptionChange={setCommitDescription}
        onAmendChange={setAmendPreviousCommit}
        onOptionsExpandedChange={setOptionsExpanded}
        onOptionsChange={setCommitOptions}
        onCommit={handleCommit}
      />
    </aside>
  );
}

function SegmentedButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Rows3;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs transition",
        active
          ? "border-cyan-300/30 bg-cyan-400/12 text-cyan-100"
          : "border-white/10 bg-white/[0.035] text-slate-400 hover:bg-white/[0.07] hover:text-slate-100"
      )}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function sortFiles(files: ChangedFile[], sortMode: "az" | "za") {
  return [...files].sort((a, b) => {
    const result = a.path.localeCompare(b.path);
    return sortMode === "az" ? result : -result;
  });
}

function countUniqueFiles(stagedFiles: ChangedFile[], unstagedFiles: ChangedFile[]) {
  return new Set([...stagedFiles, ...unstagedFiles].map((file) => file.path)).size;
}

function getBlockingReason(status: ReturnType<typeof useRepositoryStore.getState>["snapshot"]["workingDirectoryStatus"]) {
  if (status.conflictedFiles.length > 0) {
    return `Resolve ${status.conflictedFiles.length} conflicted file${status.conflictedFiles.length === 1 ? "" : "s"} before committing.`;
  }
  if (status.rebaseInProgress) {
    return "A rebase is in progress. Finish or abort it before committing from this panel.";
  }
  if (status.mergeInProgress) {
    return "A merge is in progress. Finish or abort it before committing from this panel.";
  }
  return null;
}

function toggleFolder(
  setter: (updater: (value: Set<string>) => Set<string>) => void,
  folderPath: string,
) {
  setter((value) => {
    const next = new Set(value);
    if (next.has(folderPath)) {
      next.delete(folderPath);
    } else {
      next.add(folderPath);
    }
    return next;
  });
}
