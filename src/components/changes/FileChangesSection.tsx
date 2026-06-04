import { ChevronDown, ChevronsDownUp, ChevronsUpDown, CheckCircle2, Layers3 } from "lucide-react";
import type { ChangedFile } from "../../shared/types";
import { cn } from "../../lib/utils";
import { FilePathView } from "./FilePathView";
import { buildTree, FileTreeView } from "./FileTreeView";

type FileChangesSectionProps = {
  title: string;
  mode: "unstaged" | "staged";
  files: ChangedFile[];
  viewMode: "path" | "tree";
  expanded: boolean;
  expandedFolders: Set<string>;
  onToggleSection: () => void;
  onToggleFolder: (folderPath: string) => void;
  onExpandAll: (folderPaths: string[]) => void;
  onCollapseAll: (folderPaths: string[]) => void;
  onStageFile?: (filePath: string) => void;
  onStageFolder?: (folderPath: string) => void;
  onStageAll?: () => void;
  onUnstageFile?: (filePath: string) => void;
  onUnstageFolder?: (folderPath: string) => void;
  onUnstageAll?: () => void;
  onDiscard?: (filePath: string) => void;
  onDiff: (filePath: string, staged: boolean) => void;
  onOpenFile?: (filePath: string) => void;
};

export function FileChangesSection({
  title,
  mode,
  files,
  viewMode,
  expanded,
  expandedFolders,
  onToggleSection,
  onToggleFolder,
  onExpandAll,
  onCollapseAll,
  onStageFile,
  onStageFolder,
  onStageAll,
  onUnstageFile,
  onUnstageFolder,
  onUnstageAll,
  onDiscard,
  onDiff,
  onOpenFile,
}: FileChangesSectionProps) {
  const folderPaths = viewMode === "tree" ? collectFolderPaths(files) : [];
  const allExpanded = folderPaths.length > 0 && folderPaths.every((folderPath) => expandedFolders.has(folderPath));

  return (
    <section className="rounded-md border border-white/[0.08] bg-[#0c111a] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex min-h-10 items-center gap-2 border-b border-white/[0.06] px-3">
        <button
          type="button"
          onClick={onToggleSection}
          className="grid h-6 w-6 shrink-0 place-items-center rounded text-slate-500 transition hover:bg-white/[0.08] hover:text-slate-100"
          title={expanded ? "Collapse section" : "Expand section"}
        >
          <ChevronDown size={14} className={cn("transition", !expanded && "-rotate-90")} />
        </button>
        {mode === "unstaged" ? (
          <Layers3 size={14} className="shrink-0 text-cyan-300/80" />
        ) : (
          <CheckCircle2 size={14} className="shrink-0 text-emerald-300/80" />
        )}
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase text-slate-400">{title}</span>
        <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-500">{files.length}</span>
        {viewMode === "tree" && files.length > 0 ? (
          <button
            type="button"
            onClick={() => allExpanded ? onCollapseAll(folderPaths) : onExpandAll(folderPaths)}
            className="grid h-7 w-7 place-items-center rounded text-slate-500 transition hover:bg-white/[0.08] hover:text-slate-100"
            title={allExpanded ? "Collapse all" : "Expand all"}
          >
            {allExpanded ? <ChevronsDownUp size={14} /> : <ChevronsUpDown size={14} />}
          </button>
        ) : null}
        {mode === "unstaged" ? (
          <button
            type="button"
            disabled={!files.length}
            onClick={onStageAll}
            className="rounded border border-cyan-300/20 bg-cyan-400/10 px-2 py-1 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-400/16 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Stage All Changes
          </button>
        ) : (
          <button
            type="button"
            disabled={!files.length}
            onClick={onUnstageAll}
            className="rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold text-slate-300 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Unstage all
          </button>
        )}
      </div>

      {expanded ? (
        viewMode === "path" ? (
          <FilePathView
            files={files}
            mode={mode}
            onStage={onStageFile}
            onUnstage={onUnstageFile}
            onDiscard={onDiscard}
            onDiff={onDiff}
            onOpenFile={onOpenFile}
          />
        ) : (
          <FileTreeView
            files={files}
            mode={mode}
            expandedFolders={expandedFolders}
            onToggleFolder={onToggleFolder}
            onStageFile={onStageFile}
            onStageFolder={onStageFolder}
            onUnstageFile={onUnstageFile}
            onUnstageFolder={onUnstageFolder}
            onDiscard={onDiscard}
            onDiff={onDiff}
            onOpenFile={onOpenFile}
          />
        )
      ) : null}
    </section>
  );
}

function collectFolderPaths(files: ChangedFile[]) {
  const root = buildTree(files);
  const paths: string[] = [];
  const walk = (nodes: typeof root.folders) => {
    nodes.forEach((node) => {
      paths.push(node.path);
      walk(node.folders);
    });
  };
  walk(root.folders);
  return paths;
}
