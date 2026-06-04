import type {
  Branch,
  BranchActionRequest,
  BranchContext,
  BranchKind,
  CommitNode,
  GitOperationResult,
  RepositorySnapshot,
  ResetMode,
} from "../shared/types";
import { branchHiddenKey, useBranchVisibilityStore } from "../store/branchVisibilityStore";
import { useRepositoryStore } from "../store/repositoryStore";

type ActionRunner = (request: BranchActionRequest) => Promise<GitOperationResult>;

export function buildBranchContext(
  snapshot: RepositorySnapshot,
  branchName: string,
  branchType: BranchKind,
  commitSha?: string,
): BranchContext | null {
  if (!snapshot.path) return null;
  const branch = snapshot.branches.find((candidate) => candidate.name === branchName && candidate.kind === branchType)
    ?? snapshot.branches.find((candidate) => candidate.name === branchName);
  const remoteName = branch?.remoteName ?? getRemoteName(branchName, branch?.upstream);
  const remoteUrl = snapshot.remotes.find((remote) => remote.name === remoteName)?.push
    ?? snapshot.remotes.find((remote) => remote.name === remoteName)?.fetch
    ?? snapshot.remotes[0]?.push
    ?? snapshot.remotes[0]?.fetch;
  const resolvedCommitSha = commitSha
    ?? branch?.lastCommit
    ?? snapshot.commits.find((commit) => commit.refs.includes(branchName))?.hash
    ?? "";

  if (!resolvedCommitSha) return null;

  return {
    repositoryPath: snapshot.path,
    branchName,
    branchType: branch?.kind ?? branchType,
    remoteName,
    remoteUrl,
    commitSha: resolvedCommitSha,
    currentBranch: snapshot.activeBranch,
    upstream: branch?.upstream,
    isCheckedOut: branch?.current || branchName === snapshot.activeBranch,
    isProtectedBranch: isProtectedBranch(branchName),
    workingDirectoryStatus: snapshot.workingDirectoryStatus,
    stagedFiles: snapshot.workingDirectoryStatus.stagedFiles,
    unstagedFiles: snapshot.workingDirectoryStatus.unstagedFiles,
  };
}

export async function handlePullRebase(context: BranchContext) {
  if (!context.upstream) {
    useRepositoryStore.getState().notify("error", "Pull rebase requires an upstream. Use Set Upstream first.");
    return;
  }
  if (context.workingDirectoryStatus.hasUncommittedChanges && !confirm("Working directory has uncommitted changes. Continue with pull --rebase?")) {
    return;
  }
  await runGitAction(window.gitCoso.pullRebaseBranch, { context });
}

export async function handlePush(context: BranchContext) {
  if (context.branchType === "remote") {
    useRepositoryStore.getState().notify("error", "Remote-only branches cannot be pushed directly. Create a local tracking branch first.");
    return;
  }
  const remoteName = context.upstream ? context.remoteName : prompt("No upstream configured. Push with -u to remote:", context.remoteName || "origin");
  if (!remoteName) return;
  await runGitAction(window.gitCoso.pushBranch, { context, remoteName });
}

export async function handleSetUpstream(context: BranchContext) {
  if (context.branchType !== "local") {
    useRepositoryStore.getState().notify("error", "Set Upstream requires a local branch.");
    return;
  }
  const remoteBranch = prompt("Remote branch, for example origin/main:", context.upstream || `${context.remoteName || "origin"}/${context.branchName}`);
  if (!remoteBranch) return;
  await runGitAction(window.gitCoso.setBranchUpstream, { context, remoteBranch });
}

export async function handleCreateBranchHere(context: BranchContext) {
  const newBranchName = prompt("New branch name:");
  if (!newBranchName) return;
  const checkout = confirm("Checkout the new branch immediately?");
  await runGitAction(window.gitCoso.createBranchAtCommit, { context, newBranchName, checkout });
}

export async function handleResetBranchToThisCommit(context: BranchContext) {
  if (!confirmRewriteWarning(context, "Reset branch to this commit")) return;
  const resetMode = prompt("Reset mode: soft, mixed, or hard", "mixed") as ResetMode | null;
  if (!resetMode || !["soft", "mixed", "hard"].includes(resetMode)) return;
  if (resetMode === "hard" && !confirm("Hard reset discards changes in the checked-out branch. Continue?")) return;
  if (context.workingDirectoryStatus.hasUncommittedChanges && !confirm("Uncommitted changes detected. Continue reset?")) return;
  await runGitAction(window.gitCoso.resetBranchToCommit, { context, resetMode });
}

export async function handleEditCommitMessage(context: BranchContext) {
  if (!confirmRewriteWarning(context, "Edit commit message")) return;
  const newMessage = prompt("New commit message:");
  if (!newMessage) return;
  await runGitAction(window.gitCoso.editCommitMessage, { context, newMessage });
}

export async function handleRevertCommit(context: BranchContext, commit?: CommitNode) {
  const mainlineParent = commit && commit.parents.length > 1
    ? Number(prompt("Merge commit parent number:", "1"))
    : undefined;
  if (commit && commit.parents.length > 1 && (!mainlineParent || Number.isNaN(mainlineParent))) return;
  await runGitAction(window.gitCoso.revertCommit, { context, mainlineParent });
}

export async function handleDropCommit(context: BranchContext) {
  if (!confirmRewriteWarning(context, "Drop commit")) return;
  if (!confirm("Drop removes this commit from history. Continue?")) return;
  await runGitAction(window.gitCoso.dropCommit, { context });
}

export async function handleStartPullRequest(context: BranchContext) {
  const link = buildPullRequestUrl(context);
  if (!link) {
    useRepositoryStore.getState().notify("error", "Unsupported or missing remote URL.");
    return;
  }
  window.open(link, "_blank", "noopener,noreferrer");
}

export async function handleExplainBranchChanges(context: BranchContext) {
  const result = await runGitAction(window.gitCoso.explainBranchChanges, { context }, false);
  const summary = typeof result?.data?.summary === "string" ? result.data.summary : result?.message;
  if (summary) alert(summary.slice(0, 5000));
}

export async function handleApplyPatch(context: BranchContext) {
  const patch = prompt("Paste patch content:");
  if (!patch) return;
  await runGitAction(window.gitCoso.applyPatch, { context, patch });
}

export async function handleRenameBranch(context: BranchContext) {
  if (context.branchType !== "local") {
    useRepositoryStore.getState().notify("error", "Remote-only branches cannot be renamed directly.");
    return;
  }
  const newName = prompt("New branch name:", context.branchName);
  if (!newName || newName === context.branchName) return;
  await runGitAction(window.gitCoso.renameBranch, { context, newName });
}

export async function handleDeleteBranch(context: BranchContext) {
  if (context.isCheckedOut) {
    useRepositoryStore.getState().notify("error", "Cannot delete the checked-out branch.");
    return;
  }
  if (!confirm(`Delete branch ${context.branchName}?`)) return;
  const force = context.branchType === "local" ? confirm("Force delete if branch is not merged?") : false;
  await runGitAction(window.gitCoso.deleteBranch, { context, force });
}

export async function handleCopyBranchName(context: BranchContext) {
  await copyText(context.branchName, "Branch name copied.");
}

export async function handleCopyCommitSha(context: BranchContext) {
  await copyText(context.commitSha, "Commit SHA copied.");
}

export async function handleCopyLinkToBranch(context: BranchContext) {
  const link = buildBranchUrl(context);
  if (!link) {
    useRepositoryStore.getState().notify("error", "Unsupported or missing remote URL.");
    return;
  }
  await copyText(link, "Branch link copied.");
}

export async function handleCopyLinkToCommit(context: BranchContext) {
  const link = buildCommitUrl(context);
  if (!link) {
    useRepositoryStore.getState().notify("error", "Unsupported or missing remote URL.");
    return;
  }
  await copyText(link, "Commit link copied.");
}

export function handleHideBranch(context: BranchContext) {
  const repoKey = context.repositoryPath;
  useBranchVisibilityStore.getState().setBranchHidden(repoKey, context.branchType, context.branchName, true);
  useRepositoryStore.getState().notify("info", "Branch hidden from graph.");
}

export function handlePinToLeft(context: BranchContext) {
  const repoKey = context.repositoryPath;
  const store = useBranchVisibilityStore.getState();
  const key = branchHiddenKey(repoKey, context.branchType, context.branchName);
  store.setBranchPinned(repoKey, context.branchType, context.branchName, !store.pinnedBranches.has(key));
  useRepositoryStore.getState().notify("info", "Branch pin updated.");
}

export function handleSoloBranch(context: BranchContext) {
  const repoKey = context.repositoryPath;
  const store = useBranchVisibilityStore.getState();
  const key = branchHiddenKey(repoKey, context.branchType, context.branchName);
  store.setBranchSolo(repoKey, context.branchType, context.branchName, !store.soloBranches.has(key));
  useRepositoryStore.getState().notify("info", "Solo branch mode updated.");
}

export async function handleCompareCommitAgainstWorkingDirectory(context: BranchContext) {
  const result = await runGitAction(window.gitCoso.compareCommitWithWorkingDirectory, { context }, false);
  const diff = typeof result?.data?.diff === "string" ? result.data.diff : result?.message;
  if (diff) alert(diff.slice(0, 5000));
}

export async function handleCreateTagHere(context: BranchContext) {
  const tagName = prompt("Tag name:");
  if (!tagName) return;
  await runGitAction(window.gitCoso.createTagAtCommit, { context, tagName });
}

export async function handleCreateAnnotatedTagHere(context: BranchContext) {
  const tagName = prompt("Tag name:");
  if (!tagName) return;
  const tagMessage = prompt("Tag message:");
  if (!tagMessage) return;
  await runGitAction(window.gitCoso.createAnnotatedTagAtCommit, { context, tagName, tagMessage });
}

async function runGitAction(
  action: ActionRunner,
  request: BranchActionRequest,
  notifySuccess = true,
) {
  try {
    const result = await action(request);
    if (result.snapshot) {
      await useRepositoryStore.getState().applySnapshot(result.snapshot);
    } else {
      await useRepositoryStore.getState().refresh();
    }
    if (notifySuccess) {
      useRepositoryStore.getState().notify(result.ok ? "success" : "error", result.message);
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Git action failed.";
    useRepositoryStore.getState().notify("error", message);
    return null;
  }
}

async function copyText(text: string, message: string) {
  await navigator.clipboard.writeText(text);
  useRepositoryStore.getState().notify("success", message);
}

function confirmRewriteWarning(context: BranchContext, action: string) {
  const pushedWarning = context.upstream ? " This branch has an upstream; rewriting history may require force push." : "";
  return confirm(`${action} rewrites history.${pushedWarning} Continue?`);
}

function buildCommitUrl(context: BranchContext) {
  const remote = parseRemoteWebUrl(context.remoteUrl);
  if (!remote) return null;
  if (remote.provider === "github") return `${remote.base}/commit/${context.commitSha}`;
  if (remote.provider === "gitlab") return `${remote.base}/-/commit/${context.commitSha}`;
  if (remote.provider === "bitbucket") return `${remote.base}/commits/${context.commitSha}`;
  return `${remote.base}/commit/${context.commitSha}`;
}

function buildBranchUrl(context: BranchContext) {
  const remote = parseRemoteWebUrl(context.remoteUrl);
  if (!remote) return null;
  const branchName = context.branchType === "remote"
    ? context.branchName.replace(new RegExp(`^${context.remoteName || "origin"}/`), "")
    : context.branchName;
  const encodedBranch = encodeURIComponent(branchName);
  if (remote.provider === "github") return `${remote.base}/tree/${encodedBranch}`;
  if (remote.provider === "gitlab") return `${remote.base}/-/tree/${encodedBranch}`;
  if (remote.provider === "bitbucket") return `${remote.base}/branch/${encodedBranch}`;
  return `${remote.base}/tree/${encodedBranch}`;
}

function buildPullRequestUrl(context: BranchContext) {
  const remote = parseRemoteWebUrl(context.remoteUrl);
  if (!remote) return null;
  const source = encodeURIComponent(context.branchName.replace(new RegExp(`^${context.remoteName || "origin"}/`), ""));
  const base = encodeURIComponent(getBaseBranch(context));
  if (remote.provider === "github") return `${remote.base}/compare/${base}...${source}?expand=1`;
  if (remote.provider === "gitlab") return `${remote.base}/-/merge_requests/new?merge_request[source_branch]=${source}&merge_request[target_branch]=${base}`;
  if (remote.provider === "bitbucket") return `${remote.base}/pull-requests/new?source=${source}&dest=${base}`;
  return remote.base;
}

function parseRemoteWebUrl(remoteUrl?: string) {
  if (!remoteUrl) return null;
  const normalized = remoteUrl
    .replace(/\.git$/, "")
    .replace(/^git@([^:]+):(.+)$/, "https://$1/$2")
    .replace(/^ssh:\/\/git@([^/]+)\/(.+)$/, "https://$1/$2");
  const provider = normalized.includes("github.com")
    ? "github"
    : normalized.includes("gitlab.")
      ? "gitlab"
      : normalized.includes("bitbucket.")
        ? "bitbucket"
        : "unknown";
  return { base: normalized, provider };
}

function getRemoteName(branchName: string, upstream?: string) {
  if (upstream) return upstream.split("/")[0];
  return branchName.includes("/") ? branchName.split("/")[0] : "origin";
}

function getBaseBranch(context: BranchContext) {
  if (context.upstream) return context.upstream.replace(new RegExp(`^${context.remoteName || "origin"}/`), "");
  return ["main", "master", "dev"].includes(context.branchName) ? "main" : "main";
}

function isProtectedBranch(branchName: string) {
  const normalized = branchName.replace(/^origin\//, "");
  return ["main", "master", "develop", "dev", "release"].includes(normalized);
}
