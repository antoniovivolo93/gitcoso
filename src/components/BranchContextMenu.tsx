import type { BranchContext, CommitNode } from "../shared/types";
import { useSettingsStore } from "../store/settingsStore";
import {
  handleApplyPatch,
  handleCompareCommitAgainstWorkingDirectory,
  handleCopyBranchName,
  handleCopyCommitSha,
  handleCopyLinkToBranch,
  handleCopyLinkToCommit,
  handleCreateAnnotatedTagHere,
  handleCreateBranchHere,
  handleCreateTagHere,
  handleDeleteBranch,
  handleDropCommit,
  handleEditCommitMessage,
  handleExplainBranchChanges,
  handleHideBranch,
  handlePinToLeft,
  handlePullRebase,
  handlePush,
  handleRenameBranch,
  handleResetBranchToThisCommit,
  handleRevertCommit,
  handleSetUpstream,
  handleSoloBranch,
  handleStartPullRequest,
} from "../lib/branchContextActions";

export type BranchContextMenuState = {
  x: number;
  y: number;
  context: BranchContext;
  commit?: CommitNode;
};

type MenuAction = {
  label: string;
  disabled?: boolean;
  run: () => void | Promise<void>;
};

export function BranchContextMenu({
  state,
  onClose,
}: {
  state: BranchContextMenuState | null;
  onClose: () => void;
}) {
  const t = useSettingsStore().t;
  if (!state) return null;

  const { context, commit } = state;
  const actions: MenuAction[] = [
    { label: t("context.pullRebase"), disabled: context.branchType !== "local", run: () => handlePullRebase(context) },
    { label: t("actions.push"), disabled: context.branchType === "remote", run: () => handlePush(context) },
    { label: t("context.setUpstream"), disabled: context.branchType !== "local", run: () => handleSetUpstream(context) },
    { label: t("context.createBranchHere"), run: () => handleCreateBranchHere(context) },
    { label: t("context.resetBranch"), disabled: context.branchType !== "local", run: () => handleResetBranchToThisCommit(context) },
    { label: t("context.editCommit"), run: () => handleEditCommitMessage(context) },
    { label: t("context.revertCommit"), run: () => handleRevertCommit(context, commit) },
    { label: t("context.dropCommit"), run: () => handleDropCommit(context) },
    { label: t("context.startPr"), run: () => handleStartPullRequest(context) },
    { label: t("context.explainChanges"), run: () => handleExplainBranchChanges(context) },
    { label: t("context.applyPatch"), run: () => handleApplyPatch(context) },
    { label: t("context.renameBranch"), disabled: context.branchType !== "local", run: () => handleRenameBranch(context) },
    { label: t("context.deleteBranch"), disabled: context.isCheckedOut, run: () => handleDeleteBranch(context) },
    { label: t("context.copyBranch"), run: () => handleCopyBranchName(context) },
    { label: t("context.copySha"), run: () => handleCopyCommitSha(context) },
    { label: t("context.copyBranchLink"), run: () => handleCopyLinkToBranch(context) },
    { label: t("context.copyCommitLink"), run: () => handleCopyLinkToCommit(context) },
    { label: t("branch.hide"), run: () => handleHideBranch(context) },
    { label: t("context.pinLeft"), run: () => handlePinToLeft(context) },
    { label: t("context.soloBranch"), run: () => handleSoloBranch(context) },
    { label: t("context.compareWorking"), run: () => handleCompareCommitAgainstWorkingDirectory(context) },
    { label: t("context.createTag"), run: () => handleCreateTagHere(context) },
    { label: t("context.createAnnotatedTag"), run: () => handleCreateAnnotatedTagHere(context) },
  ];

  return (
    <>
      <button type="button" className="fixed inset-0 z-40 cursor-default" onClick={onClose} aria-label="Close context menu" />
      <div
        className="fixed z-50 max-h-[70vh] min-w-64 overflow-auto rounded-md border border-white/10 bg-[#111722] p-1 text-sm text-slate-200 shadow-2xl"
        style={{ left: state.x, top: state.y }}
      >
        <div className="border-b border-white/10 px-2 py-1.5 text-xs text-slate-500">
          {context.branchName} · {context.commitSha.slice(0, 7)}
        </div>
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            disabled={action.disabled}
            onClick={() => {
              onClose();
              void action.run();
            }}
            className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:text-slate-600"
          >
            {action.label}
          </button>
        ))}
      </div>
    </>
  );
}
