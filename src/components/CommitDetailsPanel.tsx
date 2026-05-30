import { FileCode2, MoreVertical } from "lucide-react";
import { formatDate } from "../lib/utils";
import { useRepositoryStore } from "../store/repositoryStore";
import { cn } from "../lib/utils";

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

  return (
    <aside className="min-h-0 overflow-auto border-l border-white/[0.08] bg-[#171b25] p-5">
      {!selectedDetails ? (
        <div className="rounded-md border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400">
          Select a commit to inspect its files and summary diff.
        </div>
      ) : (
        <div className="space-y-5">
          <section>
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-slate-700 text-sm font-semibold text-white shadow-[0_0_0_3px_rgba(255,255,255,0.04)]">
                {getInitials(selectedDetails.author)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-50">{selectedDetails.author}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                  <span className="rounded bg-violet-500/28 px-1.5 py-0.5 font-mono text-violet-100 ring-1 ring-violet-400/25">
                    {selectedDetails.shortHash}
                  </span>
                  <span>{formatDate(selectedDetails.date)}</span>
                </div>
              </div>
              <button className="grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-white/[0.08] hover:text-slate-100">
                <MoreVertical size={16} />
              </button>
            </div>

            <h2 className="mb-3 text-lg font-semibold leading-6 text-slate-50">{selectedDetails.message}</h2>
            <div className="rounded-md border border-white/[0.11] bg-[#10141d] p-3 text-sm leading-6 text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              {selectedDetails.body || "Commit metadata and file changes loaded from the selected repository."}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase text-slate-400">
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
                  <div
                    key={`${file.status}-${file.path}`}
                    className="grid min-h-9 grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-transparent px-2 text-sm text-slate-300 transition hover:border-white/12 hover:bg-white/[0.055]"
                  >
                      <span
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold",
                          file.status === "added" && "bg-emerald-400/15 text-emerald-300",
                          file.status === "modified" && "bg-sky-400/15 text-sky-300",
                          file.status === "deleted" && "bg-rose-400/15 text-rose-300",
                          file.status === "renamed" && "bg-violet-400/15 text-violet-300"
                        )}
                      >
                        {statusLabel[file.status]}
                      </span>
                      <span className="min-w-0 truncate">{file.path}</span>
                    {typeof file.additions === "number" || typeof file.deletions === "number" ? (
                      <span className="font-mono text-xs">
                        <span className="text-emerald-400">+{file.additions ?? 0}</span>{" "}
                        <span className="text-rose-400">-{file.deletions ?? 0}</span>
                      </span>
                    ) : <span />}
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase text-slate-400">Diff</h3>
            <pre className="max-h-80 overflow-auto rounded-md border border-white/[0.11] bg-[#070a0f] p-4 font-mono text-xs leading-5 text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
              {selectedDetails.diff || "No diff summary available."}
            </pre>
          </section>
        </div>
      )}
    </aside>
  );
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
