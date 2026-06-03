import { useEffect, useState } from "react";
import {
  GitCommitHorizontal,
  GitPullRequestArrow,
  Plus,
  RefreshCw,
  Upload,
  Download,
  FolderOpen,
  Check,
  X,
  CircleCheck,
  Info,
  Terminal,
  Trash2,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { CommitDetailsPanel } from "./components/CommitDetailsPanel";
import { CommitGraph } from "./components/CommitGraph";
import { Sidebar } from "./components/Sidebar";
import { CheckoutBlockedDialog } from "./components/dialogs/CheckoutBlockedDialog";
import { CreateBranchDialog } from "./components/dialogs/CreateBranchDialog";
import { CommitDialog } from "./components/dialogs/CommitDialog";
import { Button } from "./components/ui/Button";
import { useRepositoryStore } from "./store/repositoryStore";
import type { CommandLogEntry } from "./store/repositoryStore";

export default function App() {
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [commitDialogOpen, setCommitDialogOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const { snapshot, loading, error, toast, commandLogs, desktopReady, syncDesktopBridge, clearToast, clearCommandLogs, openRepository, refresh, fetch, pull, push } = useRepositoryStore();
  const gitActionsDisabled = loading || !snapshot.path;

  useEffect(() => {
    syncDesktopBridge();
    const bridgeCheck = window.setInterval(syncDesktopBridge, 500);
    return () => window.clearInterval(bridgeCheck);
  }, [syncDesktopBridge]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(clearToast, 4200);
    return () => window.clearTimeout(timeout);
  }, [toast, clearToast]);

  return (
    <div className="h-screen overflow-hidden bg-surface-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(139,92,246,0.18),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(56,189,248,0.12),transparent_28%)]" />
      <div
        className="relative grid h-full"
        style={{
          gridTemplateRows: terminalOpen ? "64px minmax(0,1fr) 260px" : "64px minmax(0,1fr)",
        }}
      >
        <header className="drag-region flex items-center justify-between border-b border-white/10 bg-surface-900/92 px-5 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="no-drag flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-accent-violet to-accent-blue shadow-glow">
              <GitCommitHorizontal size={20} />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-wide">BranchFlow</h1>
              <p className="text-xs text-slate-400">{snapshot.statusSummary}</p>
            </div>
          </div>

          <nav className="no-drag flex items-center gap-2">
            <Button icon={FolderOpen} onClick={openRepository} disabled={loading || !desktopReady}>
              Open
            </Button>
            <Button icon={RefreshCw} onClick={refresh} disabled={gitActionsDisabled}>
              Refresh
            </Button>
            <Button icon={Download} onClick={fetch} disabled={gitActionsDisabled}>
              Fetch
            </Button>
            <Button icon={GitPullRequestArrow} onClick={pull} disabled={gitActionsDisabled}>
              Pull
            </Button>
            <Button icon={Upload} onClick={push} disabled={gitActionsDisabled}>
              Push
            </Button>
            <Button icon={Plus} onClick={() => setBranchDialogOpen(true)} disabled={gitActionsDisabled}>
              Branch
            </Button>
            <Button icon={Check} variant="primary" onClick={() => setCommitDialogOpen(true)} disabled={gitActionsDisabled}>
              Commit
            </Button>
            <Button icon={terminalOpen ? ChevronDown : ChevronUp} onClick={() => setTerminalOpen((value) => !value)}>
              Terminal
            </Button>
          </nav>
        </header>

        <main
          className="grid min-h-0"
          style={{
            gridTemplateColumns: `${sidebarCollapsed ? "48px" : "236px"} minmax(520px,1fr) 360px`,
          }}
        >
          <Sidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((value) => !value)} />
          <section className="min-h-0 min-w-0 border-x border-white/[0.09] bg-[#070a0f]">
            {error ? <div className="mx-5 mt-4 rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</div> : null}
            <CommitGraph />
          </section>
          <CommitDetailsPanel />
        </main>
        {terminalOpen ? (
          <CommandTerminal logs={commandLogs} onClear={clearCommandLogs} onClose={() => setTerminalOpen(false)} />
        ) : null}
      </div>

      <CreateBranchDialog open={branchDialogOpen} onClose={() => setBranchDialogOpen(false)} />
      <CommitDialog open={commitDialogOpen} onClose={() => setCommitDialogOpen(false)} />
      <CheckoutBlockedDialog />
      {toast ? <Toast message={toast.message} type={toast.type} onClose={clearToast} /> : null}
    </div>
  );
}

function CommandTerminal({
  logs,
  onClear,
  onClose,
}: {
  logs: CommandLogEntry[];
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <section className="min-h-0 w-full border-t border-white/[0.09] bg-[#070a0f]/98">
      <div className="flex h-10 items-center gap-2 border-b border-white/[0.07] px-4 text-xs text-slate-400">
        <Terminal size={15} className="text-cyan-300" />
        <span className="font-semibold uppercase tracking-wide">Terminal</span>
        <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-500">{logs.length}</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onClear}
          className="grid h-7 w-7 place-items-center rounded text-slate-500 transition hover:bg-white/[0.08] hover:text-slate-100"
          title="Clear terminal"
        >
          <Trash2 size={14} />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded text-slate-500 transition hover:bg-white/[0.08] hover:text-slate-100"
          title="Hide terminal"
        >
          <ChevronDown size={15} />
        </button>
      </div>
      <div className="h-[220px] overflow-auto px-4 py-3 font-mono text-[12px] leading-6">
        {logs.length === 0 ? (
          <p className="text-slate-600">Nessun comando eseguito.</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="grid grid-cols-[84px_86px_minmax(0,1fr)] gap-3 border-b border-white/[0.025] py-0.5 last:border-b-0">
              <span className="text-slate-600">{log.createdAt}</span>
              <span className={getCommandStatusClass(log.status)}>{log.status}</span>
              <span className="min-w-0 truncate text-slate-300">
                <span className="text-cyan-300">$</span> {log.command}
                {log.message ? <span className="ml-2 text-rose-300">{log.message}</span> : null}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function getCommandStatusClass(status: CommandLogEntry["status"]) {
  if (status === "success") return "text-emerald-300";
  if (status === "error") return "text-rose-300";
  return "text-amber-300";
}

function Toast({ message, type, onClose }: { message: string; type: "success" | "info" | "error"; onClose: () => void }) {
  const Icon = type === "success" ? CircleCheck : type === "error" ? X : Info;

  return (
    <div className="fixed right-5 top-20 z-50 flex min-h-12 w-[320px] items-center gap-3 rounded-md border border-white/10 bg-[#121926]/95 px-3 py-2.5 text-sm text-slate-100 shadow-2xl backdrop-blur">
      <Icon size={18} className={type === "success" ? "text-emerald-300" : type === "error" ? "text-rose-300" : "text-cyan-300"} />
      <span className="min-w-0 flex-1 leading-5">{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="grid h-7 w-7 place-items-center rounded text-slate-500 transition hover:bg-white/[0.08] hover:text-slate-100"
        title="Close"
      >
        <X size={14} />
      </button>
    </div>
  );
}
