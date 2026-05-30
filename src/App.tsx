import { useEffect, useState } from "react";
import {
  GitCommitHorizontal,
  GitPullRequestArrow,
  Plus,
  RefreshCw,
  Upload,
  Download,
  FolderOpen,
  Check
} from "lucide-react";
import { CommitDetailsPanel } from "./components/CommitDetailsPanel";
import { CommitGraph } from "./components/CommitGraph";
import { Sidebar } from "./components/Sidebar";
import { CheckoutBlockedDialog } from "./components/dialogs/CheckoutBlockedDialog";
import { CreateBranchDialog } from "./components/dialogs/CreateBranchDialog";
import { CommitDialog } from "./components/dialogs/CommitDialog";
import { Button } from "./components/ui/Button";
import { useRepositoryStore } from "./store/repositoryStore";

export default function App() {
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [commitDialogOpen, setCommitDialogOpen] = useState(false);
  const { snapshot, loading, error, desktopReady, syncDesktopBridge, openRepository, refresh, fetch, pull, push } = useRepositoryStore();
  const gitActionsDisabled = loading || !snapshot.path;

  useEffect(() => {
    syncDesktopBridge();
    const bridgeCheck = window.setInterval(syncDesktopBridge, 500);
    return () => window.clearInterval(bridgeCheck);
  }, [syncDesktopBridge]);

  return (
    <div className="h-screen overflow-hidden bg-surface-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(139,92,246,0.18),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(56,189,248,0.12),transparent_28%)]" />
      <div className="relative grid h-full grid-rows-[64px_1fr]">
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
          </nav>
        </header>

        <main className="grid min-h-0 grid-cols-[280px_minmax(520px,1fr)_360px]">
          <Sidebar />
          <section className="min-w-0 border-x border-white/[0.09] bg-[#070a0f]">
            {error ? <div className="mx-5 mt-4 rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</div> : null}
            <CommitGraph />
          </section>
          <CommitDetailsPanel />
        </main>
      </div>

      <CreateBranchDialog open={branchDialogOpen} onClose={() => setBranchDialogOpen(false)} />
      <CommitDialog open={commitDialogOpen} onClose={() => setCommitDialogOpen(false)} />
      <CheckoutBlockedDialog />
    </div>
  );
}
