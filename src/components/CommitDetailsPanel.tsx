import { CheckCircle2, File, FileCode2, Folder, GitCommitHorizontal, Layers3, MoreVertical, Plus } from "lucide-react";
import { formatDate } from "../lib/utils";
import { useRepositoryStore } from "../store/repositoryStore";
import { cn } from "../lib/utils";
import { Button } from "./ui/Button";
import type { ChangedFile } from "../shared/types";

const statusLabel = {
  added: "A",
  modified: "M",
  deleted: "D",
  renamed: "R",
  copied: "C",
  unknown: "?"
};

export function CommitDetailsPanel() {
  const { selectedDetails } = useRepositoryStore();
  const files = selectedDetails?.files ?? [];

  return (
    <aside className="flex min-h-0 flex-col border-l border-white/[0.08] bg-[#111722]">
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <section className="mb-4 rounded-md border border-white/[0.08] bg-[#0c111a] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <PanelHeader icon={Layers3} title="Unstaged Files" count={files.length} />
          <FileTree files={files} emptyText="Nessuna modifica unstaged rilevata." />
        </section>

        <section className="mb-5 rounded-md border border-white/[0.08] bg-[#0c111a] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <PanelHeader icon={CheckCircle2} title="Staged Files" count={0} />
          <FileTree files={[]} emptyText="Nessun file staged." />
        </section>

        {!selectedDetails ? (
          <div className="rounded-md border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400">
            Select a commit to inspect its files and summary diff.
          </div>
        ) : (
          <div className="space-y-4">
            <section>
              <div className="mb-3 flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full border border-cyan-300/25 bg-cyan-400/10 text-sm font-semibold text-cyan-50 shadow-[0_0_0_3px_rgba(34,211,238,0.05)]">
                  {getInitials(selectedDetails.author)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-50">{selectedDetails.author}</p>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="rounded bg-cyan-400/12 px-1.5 py-0.5 font-mono text-cyan-100 ring-1 ring-cyan-300/20">
                      {selectedDetails.shortHash}
                    </span>
                    <span>{formatDate(selectedDetails.date)}</span>
                  </div>
                </div>
                <button className="grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-white/[0.08] hover:text-slate-100">
                  <MoreVertical size={16} />
                </button>
              </div>

              <h2 className="mb-3 text-base font-semibold leading-6 text-slate-50">{selectedDetails.message}</h2>
              <div className="rounded-md border border-white/[0.09] bg-[#0c111a] p-3 text-sm leading-6 text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                {selectedDetails.body || "Commit metadata and file changes loaded from the selected repository."}
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase text-slate-400">
                <span className="flex items-center gap-2">
                  <FileCode2 size={14} />
                  Changed files ({selectedDetails.files.length})
                </span>
              </div>
              <div className="space-y-1">
                {selectedDetails.files.length === 0 ? (
                  <p className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-500">
                    No file list available for this commit.
                  </p>
                ) : (
                  selectedDetails.files.map((file) => (
                    <FileChangeRow key={`${file.status}-${file.path}`} file={file} />
                  ))
                )}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase text-slate-400">Diff</h3>
              <pre className="max-h-72 overflow-auto rounded-md border border-white/[0.09] bg-[#070a0f] p-3 font-mono text-xs leading-5 text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
                {selectedDetails.diff || "No diff summary available."}
              </pre>
            </section>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-white/[0.08] bg-[#0c111a]/95 p-3">
        <Button icon={Plus} className="h-9 justify-center border-cyan-300/20 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/16">
          Stage All Changes
        </Button>
        <Button icon={GitCommitHorizontal} variant="primary" className="h-9 justify-center bg-cyan-500 hover:bg-cyan-400">
          Commit
        </Button>
      </div>
    </aside>
  );
}

function PanelHeader({ icon: Icon, title, count }: { icon: typeof Layers3; title: string; count: number }) {
  return (
    <div className="flex h-9 items-center gap-2 border-b border-white/[0.06] px-3 text-[11px] font-semibold uppercase text-slate-400">
      <Icon size={14} className="text-cyan-300/80" />
      <span className="min-w-0 flex-1 truncate">{title}</span>
      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-500">{count}</span>
    </div>
  );
}

function FileTree({ files, emptyText }: { files: ChangedFile[]; emptyText: string }) {
  if (!files.length) {
    return <p className="px-3 py-2.5 text-[12px] text-slate-600">{emptyText}</p>;
  }

  const folders = groupFiles(files);

  return (
    <div className="py-1">
      {folders.map((folder) => (
        <div key={folder.name}>
          <div className="flex h-7 items-center gap-2 px-3 text-[12px] text-slate-400">
            <Folder size={13} className="text-slate-500" />
            <span className="min-w-0 flex-1 truncate">{folder.name}</span>
            <span className="text-[10px] text-slate-600">{folder.files.length}</span>
          </div>
          {folder.files.map((file) => (
            <FileChangeRow key={`${file.status}-${file.path}`} file={file} compact />
          ))}
        </div>
      ))}
    </div>
  );
}

function FileChangeRow({ file, compact }: { file: ChangedFile; compact?: boolean }) {
  return (
    <div
      className={cn(
        "grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2 rounded border border-transparent text-slate-300 transition hover:border-white/12 hover:bg-white/[0.055]",
        compact ? "mx-1.5 h-7 pl-5 pr-2 text-[12px]" : "min-h-9 px-2 text-sm"
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold",
          file.status === "added" && "bg-emerald-400/15 text-emerald-300",
          file.status === "modified" && "bg-sky-400/15 text-sky-300",
          file.status === "deleted" && "bg-rose-400/15 text-rose-300",
          file.status === "renamed" && "bg-violet-400/15 text-violet-300",
          file.status === "copied" && "bg-amber-400/15 text-amber-300",
          file.status === "unknown" && "bg-slate-400/15 text-slate-300"
        )}
      >
        {statusLabel[file.status]}
      </span>
      <span className="flex min-w-0 items-center gap-1.5 truncate">
        <File size={12} className="shrink-0 text-slate-600" />
        <span className="min-w-0 truncate">{basename(file.path)}</span>
      </span>
      {typeof file.additions === "number" || typeof file.deletions === "number" ? (
        <span className="font-mono text-xs">
          <span className="text-emerald-400">+{file.additions ?? 0}</span>{" "}
          <span className="text-rose-400">-{file.deletions ?? 0}</span>
        </span>
      ) : <span />}
    </div>
  );
}

function groupFiles(files: ChangedFile[]) {
  const groups = new Map<string, ChangedFile[]>();
  files.forEach((file) => {
    const folder = dirname(file.path);
    groups.set(folder, [...(groups.get(folder) ?? []), file]);
  });

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, folderFiles]) => ({
      name,
      files: folderFiles.sort((a, b) => a.path.localeCompare(b.path)),
    }));
}

function dirname(path: string) {
  const index = path.lastIndexOf("/");
  return index === -1 ? "." : path.slice(0, index);
}

function basename(path: string) {
  const index = path.lastIndexOf("/");
  return index === -1 ? path : path.slice(index + 1);
}

function getInitials(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "?";
}
