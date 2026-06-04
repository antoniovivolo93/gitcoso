import { Eye, File, FolderInput, FolderOutput, RotateCcw, Undo2 } from "lucide-react";
import type { ChangedFile } from "../../shared/types";
import { cn } from "../../lib/utils";

const statusLabel: Record<ChangedFile["status"], string> = {
  added: "A",
  modified: "M",
  deleted: "D",
  renamed: "R",
  copied: "C",
  unknown: "?"
};

type FilePathViewProps = {
  files: ChangedFile[];
  mode: "unstaged" | "staged";
  onStage?: (filePath: string) => void;
  onUnstage?: (filePath: string) => void;
  onDiscard?: (filePath: string) => void;
  onDiff: (filePath: string, staged: boolean) => void;
  onOpenFile?: (filePath: string) => void;
};

export function FilePathView({
  files,
  mode,
  onStage,
  onUnstage,
  onDiscard,
  onDiff,
  onOpenFile,
}: FilePathViewProps) {
  if (!files.length) {
    return (
      <p className="px-3 py-3 text-[12px] text-slate-600">
        {mode === "unstaged" ? "No unstaged changes." : "No staged files."}
      </p>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {files.map((file) => (
        <div
          key={`${mode}-${file.status}-${file.oldPath ?? ""}-${file.path}`}
          className="grid min-h-8 grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2 rounded border border-transparent px-2 text-[12px] text-slate-300 transition hover:border-white/10 hover:bg-white/[0.055]"
        >
          <StatusBadge file={file} />
          <button
            type="button"
            onClick={() => onDiff(file.path, mode === "staged")}
            className="flex min-w-0 items-center gap-1.5 text-left"
            title={file.oldPath ? `${file.oldPath} -> ${file.path}` : file.path}
          >
            <File size={12} className="shrink-0 text-slate-600" />
            <span className="min-w-0 truncate">{file.path}</span>
          </button>
          <div className="flex items-center gap-1">
            <IconButton title="Open diff" onClick={() => onDiff(file.path, mode === "staged")} icon={Eye} />
            {mode === "staged" ? (
              <>
                <IconButton title="Open file" onClick={() => onOpenFile?.(file.path)} icon={FolderOutput} />
                <IconButton title="Unstage file" onClick={() => onUnstage?.(file.path)} icon={Undo2} />
              </>
            ) : (
              <>
                <IconButton title="Stage file" onClick={() => onStage?.(file.path)} icon={FolderInput} />
                <IconButton title="Discard changes" onClick={() => onDiscard?.(file.path)} icon={RotateCcw} danger />
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatusBadge({ file }: { file: ChangedFile }) {
  return (
    <span
      className={cn(
        "flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold",
        file.status === "added" && "bg-emerald-400/15 text-emerald-300",
        file.status === "modified" && "bg-sky-400/15 text-sky-300",
        file.status === "deleted" && "bg-rose-400/15 text-rose-300",
        file.status === "renamed" && "bg-violet-400/15 text-violet-300",
        file.status === "copied" && "bg-amber-400/15 text-amber-300",
        file.status === "unknown" && "bg-slate-400/15 text-slate-300",
        file.conflicted && "ring-1 ring-rose-300/40"
      )}
      title={file.conflicted ? "Conflict" : file.status}
    >
      {file.conflicted ? "!" : statusLabel[file.status]}
    </span>
  );
}

function IconButton({
  title,
  onClick,
  icon: Icon,
  danger,
}: {
  title: string;
  onClick: () => void;
  icon: typeof Eye;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "grid h-6 w-6 place-items-center rounded text-slate-500 transition hover:bg-white/[0.08] hover:text-slate-100",
        danger && "hover:bg-rose-500/12 hover:text-rose-200"
      )}
      title={title}
    >
      <Icon size={13} />
    </button>
  );
}
