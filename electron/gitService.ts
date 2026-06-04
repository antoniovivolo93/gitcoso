import path from "node:path";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { simpleGit, SimpleGit } from "simple-git";
import {
  BranchActionRequest,
  branchColors,
  Branch,
  ChangedFile,
  CommitRequest,
  CommitDetails,
  CommitNode,
  GitOperationResult,
  RepositorySnapshot,
  WorkingDirectoryStatus,
} from "../src/shared/types.js";

function git(repoPath: string): SimpleGit {
  return simpleGit({
    baseDir: repoPath,
    binary: "git",
    maxConcurrentProcesses: 4,
  });
}

export async function getRepositorySnapshot(
  repoPath: string,
): Promise<RepositorySnapshot> {
  try {
    const repo = git(repoPath);
    const isRepo = await repo.checkIsRepo();
    if (!isRepo) {
      throw new Error("git non inizializzato");
    }

    const [branchSummary, logOutput, status, remotes] = await Promise.all([
      repo.branch(["-a"]),
      getCommitLog(repo),
      repo.status(),
      repo.getRemotes(true),
    ]);

    const branches = mapBranches(branchSummary);
    const commits = parseCommitLog(logOutput);
    const workingDirectoryStatus = await mapWorkingDirectoryStatus(repo, status);

    return {
      path: repoPath,
      name: path.basename(repoPath),
      activeBranch: branchSummary.current || "detached",
      remotes: remotes.map((remote) => ({
        name: remote.name,
        fetch: remote.refs.fetch,
        push: remote.refs.push,
      })),
      branches,
      commits,
      workingDirectoryStatus,
      lastUpdated: new Date().toISOString(),
      statusSummary: summarizeStatus(
        status.files.length,
        status.ahead,
        status.behind,
      ),
    };
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Unable to read repository",
    );
  }
}

export async function getCommitDetails(
  repoPath: string | null,
  hash: string,
): Promise<CommitDetails> {
  if (!repoPath) {
    throw new Error("No repository selected.");
  }

  try {
    const repo = git(repoPath);
    const show = await repo.show([
      "--format=%H%n%h%n%an%n%ad%n%s%n%b",
      "--date=iso",
      "--name-status",
      hash,
    ]);
    const diff = await repo.show([
      "--format=",
      "--stat",
      "--patch",
      "--max-count=1",
      hash,
    ]);
    return parseCommitDetails(show, diff);
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Unable to read commit details",
    );
  }
}

async function getCommitLog(repo: SimpleGit) {
  try {
    return await repo.raw([
      "log",
      "--all",
      "--topo-order",
      "--date=iso",
      "--decorate=short",
      "--max-count=250",
      "--pretty=format:%H%x1f%h%x1f%an%x1f%ae%x1f%ad%x1f%s%x1f%P%x1f%D",
    ]);
  } catch (error) {
    const message = normalizeGitError(error);
    if (/does not have any commits|your current branch .* does not have any commits|bad default revision/i.test(message)) {
      return "";
    }
    throw error;
  }
}

export async function checkoutBranch(
  repoPath: string,
  branch: string,
): Promise<RepositorySnapshot> {
  try {
    await git(repoPath).checkout(branch);
    return getRepositorySnapshot(repoPath);
  } catch (error) {
    throwCheckoutError(error, branch);
  }
}

export async function checkoutRemoteBranch(
  repoPath: string,
  remoteBranch: string,
): Promise<RepositorySnapshot> {
  const repo = git(repoPath);
  const localBranch = remoteBranch.replace(/^[^/]+\//, "");
  const localExists = await repo
    .raw(["rev-parse", "--verify", "--quiet", `refs/heads/${localBranch}`])
    .then(() => true)
    .catch(() => false);

  try {
    if (localExists) {
      await repo.checkout(localBranch);
    } else {
      await repo.raw(["checkout", "--track", remoteBranch]);
    }
  } catch (error) {
    throwCheckoutError(error, remoteBranch);
  }

  return getRepositorySnapshot(repoPath);
}

export async function stashAndCheckoutBranch(
  repoPath: string,
  branch: string,
): Promise<RepositorySnapshot> {
  const repo = git(repoPath);
  await repo.raw([
    "stash",
    "push",
    "-u",
    "-m",
    `GitCoso: before checkout ${branch}`,
  ]);
  await repo.checkout(branch);
  return getRepositorySnapshot(repoPath);
}

export async function createBranch(
  repoPath: string,
  name: string,
  checkout: boolean,
): Promise<RepositorySnapshot> {
  const repo = git(repoPath);
  if (checkout) {
    await repo.checkoutLocalBranch(name);
  } else {
    await repo.branch([name]);
  }
  return getRepositorySnapshot(repoPath);
}

export async function commitChanges(
  repoPath: string,
  message: string,
): Promise<RepositorySnapshot> {
  await git(repoPath).commit(message);
  return getRepositorySnapshot(repoPath);
}

export async function stageFile(
  repoPath: string,
  filePath: string,
): Promise<RepositorySnapshot> {
  await git(repoPath).raw(["add", "--", filePath]);
  return getRepositorySnapshot(repoPath);
}

export async function stageFolder(
  repoPath: string,
  folderPath: string,
): Promise<RepositorySnapshot> {
  await git(repoPath).raw(["add", "--", normalizeFolderPath(folderPath)]);
  return getRepositorySnapshot(repoPath);
}

export async function stageAll(repoPath: string): Promise<RepositorySnapshot> {
  await git(repoPath).raw(["add", "-A"]);
  return getRepositorySnapshot(repoPath);
}

export async function unstageFile(
  repoPath: string,
  filePath: string,
): Promise<RepositorySnapshot> {
  const repo = git(repoPath);
  if (await hasHead(repo)) {
    await repo.raw(["restore", "--staged", "--", filePath]);
  } else {
    await repo.raw(["rm", "--cached", "--", filePath]);
  }
  return getRepositorySnapshot(repoPath);
}

export async function unstageFolder(
  repoPath: string,
  folderPath: string,
): Promise<RepositorySnapshot> {
  const repo = git(repoPath);
  if (await hasHead(repo)) {
    await repo.raw(["restore", "--staged", "--", normalizeFolderPath(folderPath)]);
  } else {
    await repo.raw(["rm", "-r", "--cached", "--", normalizeFolderPath(folderPath)]);
  }
  return getRepositorySnapshot(repoPath);
}

export async function unstageAll(repoPath: string): Promise<RepositorySnapshot> {
  const repo = git(repoPath);
  if (await hasHead(repo)) {
    await repo.raw(["restore", "--staged", "."]);
  } else {
    await repo.raw(["rm", "-r", "--cached", "."]).catch(() => undefined);
  }
  return getRepositorySnapshot(repoPath);
}

export async function discardFile(
  repoPath: string,
  filePath: string,
): Promise<RepositorySnapshot> {
  const repo = git(repoPath);
  const status = await repo.status();
  const file = status.files.find((entry) => entry.path === filePath);
  if (file?.working_dir === "?") {
    await repo.raw(["clean", "-f", "--", filePath]);
  } else {
    await repo.raw(["restore", "--", filePath]);
  }
  return getRepositorySnapshot(repoPath);
}

export async function commitAdvanced(
  request: CommitRequest,
): Promise<RepositorySnapshot> {
  const summary = request.summary.trim();
  if (!summary) {
    throw new Error("Commit summary is required.");
  }

  const repo = git(request.repoPath);
  const args = ["commit", "-m", summary];
  const description = request.description?.trim();
  if (description) {
    args.push("-m", description);
  }
  if (request.amend) args.push("--amend");
  if (request.options?.signOff) args.push("--signoff");
  if (request.options?.allowEmpty) args.push("--allow-empty");
  if (request.options?.noVerify) args.push("--no-verify");
  if (request.options?.author?.trim()) args.push("--author", request.options.author.trim());
  if (request.options?.date?.trim()) args.push("--date", request.options.date.trim());

  await repo.raw(args);
  return getRepositorySnapshot(request.repoPath);
}

export async function getFileDiff(
  repoPath: string,
  filePath: string,
  staged: boolean,
): Promise<string> {
  if (!staged && await isUntrackedFile(repoPath, filePath)) {
    return git(repoPath).raw(["diff", "--no-index", "--", "/dev/null", filePath]);
  }

  const args = staged
    ? ["diff", "--cached", "--", filePath]
    : ["diff", "--", filePath];
  return git(repoPath).raw(args);
}

export async function fetchRepository(
  repoPath: string,
): Promise<RepositorySnapshot> {
  await git(repoPath).fetch();
  return getRepositorySnapshot(repoPath);
}

export async function pullRepository(
  repoPath: string,
): Promise<RepositorySnapshot> {
  await git(repoPath).pull();
  return getRepositorySnapshot(repoPath);
}

export async function pushRepository(
  repoPath: string,
): Promise<RepositorySnapshot> {
  await git(repoPath).push();
  return getRepositorySnapshot(repoPath);
}

export async function pullRebaseBranch(
  request: BranchActionRequest,
): Promise<GitOperationResult> {
  const { context } = request;
  assertLocalBranch(context.branchType, "Pull rebase");
  assertUpstream(context.upstream, "Pull rebase");
  const repo = git(context.repositoryPath);
  await checkoutContextBranch(repo, context);
  try {
    await repo.raw(["pull", "--rebase"]);
  } catch (error) {
    if (await isRebaseInProgress(repo)) {
      return {
        ok: false,
        message: `${normalizeGitError(error)} Rebase in progress. Resolve conflicts, then run rebase continue, or abort the rebase.`,
        snapshot: await getRepositorySnapshot(context.repositoryPath),
      };
    }
    throw new Error(normalizeGitError(error));
  }
  return withSnapshot(context.repositoryPath, "Pull rebase completed.");
}

export async function pushBranch(
  request: BranchActionRequest,
): Promise<GitOperationResult> {
  const { context } = request;
  assertLocalBranch(context.branchType, "Push");
  const repo = git(context.repositoryPath);
  try {
    if (context.upstream) {
      await repo.raw(["push"]);
    } else {
      const remoteName = request.remoteName || context.remoteName || "origin";
      await repo.raw(["push", "-u", remoteName, context.branchName]);
    }
  } catch (error) {
    throw new Error(normalizePushError(error));
  }
  return withSnapshot(context.repositoryPath, "Push completed.");
}

export async function setBranchUpstream(
  request: BranchActionRequest,
): Promise<GitOperationResult> {
  const { context, remoteBranch } = request;
  assertLocalBranch(context.branchType, "Set upstream");
  if (!remoteBranch) throw new Error("Select a remote branch to use as upstream.");
  await git(context.repositoryPath).raw([
    "branch",
    `--set-upstream-to=${remoteBranch}`,
    context.branchName,
  ]);
  return withSnapshot(context.repositoryPath, `Upstream set to ${remoteBranch}.`);
}

export async function createBranchAtCommit(
  request: BranchActionRequest,
): Promise<GitOperationResult> {
  const { context, newBranchName, checkout } = request;
  if (!newBranchName) throw new Error("Branch name is required.");
  const repo = git(context.repositoryPath);
  await validateRefName(repo, newBranchName, "branch");
  await repo.raw(["branch", newBranchName, context.commitSha]);
  if (checkout) {
    await repo.checkout(newBranchName);
  }
  return withSnapshot(context.repositoryPath, `Branch ${newBranchName} created.`);
}

export async function resetBranchToCommit(
  request: BranchActionRequest,
): Promise<GitOperationResult> {
  const { context, resetMode = "mixed" } = request;
  assertLocalBranch(context.branchType, "Reset");
  const repo = git(context.repositoryPath);
  if (context.isCheckedOut) {
    await repo.raw(["reset", `--${resetMode}`, context.commitSha]);
  } else {
    if (resetMode !== "hard") {
      throw new Error("Soft and mixed reset only apply to the checked-out branch. Use hard to move another branch ref.");
    }
    await repo.raw(["branch", "-f", context.branchName, context.commitSha]);
  }
  return withSnapshot(context.repositoryPath, `Branch reset to ${context.commitSha.slice(0, 7)}.`);
}

export async function editCommitMessage(
  request: BranchActionRequest,
): Promise<GitOperationResult> {
  const { context, newMessage } = request;
  if (!newMessage?.trim()) throw new Error("Commit message is required.");
  const repo = git(context.repositoryPath);
  const head = await repo.raw(["rev-parse", "HEAD"]);
  if (head.trim() !== context.commitSha) {
    throw new Error("Editing a non-HEAD commit requires an interactive rebase flow, which is not automated here.");
  }
  await repo.raw(["commit", "--amend", "-m", newMessage]);
  return withSnapshot(context.repositoryPath, "Commit message amended.");
}

export async function revertCommit(
  request: BranchActionRequest,
): Promise<GitOperationResult> {
  const { context, mainlineParent } = request;
  const repo = git(context.repositoryPath);
  const parents = await repo.raw(["show", "-s", "--format=%P", context.commitSha]);
  const args = ["revert", "--no-edit"];
  if (parents.trim().split(/\s+/).filter(Boolean).length > 1) {
    if (!mainlineParent) throw new Error("Merge commits require a mainline parent number.");
    args.push("-m", String(mainlineParent));
  }
  args.push(context.commitSha);
  try {
    await repo.raw(args);
  } catch (error) {
    throw new Error(`${normalizeGitError(error)} Resolve conflicts, then continue or abort the revert.`);
  }
  return withSnapshot(context.repositoryPath, "Commit reverted.");
}

export async function dropCommit(
  request: BranchActionRequest,
): Promise<GitOperationResult> {
  const { context } = request;
  const repo = git(context.repositoryPath);
  const head = (await repo.raw(["rev-parse", "HEAD"])).trim();
  if (head === context.commitSha) {
    const parent = (await repo.raw(["rev-parse", `${context.commitSha}^`])).trim();
    await repo.raw(["reset", "--hard", parent]);
    return withSnapshot(context.repositoryPath, "HEAD commit dropped.");
  }
  assertLocalBranch(context.branchType, "Drop commit");
  await repo.raw(["rebase", "--onto", `${context.commitSha}^`, context.commitSha, context.branchName]);
  return withSnapshot(context.repositoryPath, "Commit dropped by rebase.");
}

export async function renameBranch(
  request: BranchActionRequest,
): Promise<GitOperationResult> {
  const { context, newName } = request;
  assertLocalBranch(context.branchType, "Rename");
  if (!newName) throw new Error("New branch name is required.");
  const repo = git(context.repositoryPath);
  await validateRefName(repo, newName, "branch");
  await repo.raw(["branch", "-m", context.branchName, newName]);
  return withSnapshot(context.repositoryPath, `Branch renamed to ${newName}.`);
}

export async function deleteBranch(
  request: BranchActionRequest,
): Promise<GitOperationResult> {
  const { context, force } = request;
  if (context.isCheckedOut) throw new Error("Cannot delete the currently checked-out branch.");
  const repo = git(context.repositoryPath);
  if (context.branchType === "remote") {
    const { remote, branch } = splitRemoteBranch(context.branchName, context.remoteName);
    await repo.raw(["push", remote, "--delete", branch]);
  } else {
    await repo.raw(["branch", force ? "-D" : "-d", context.branchName]);
  }
  return withSnapshot(context.repositoryPath, "Branch deleted.");
}

export async function createTagAtCommit(
  request: BranchActionRequest,
): Promise<GitOperationResult> {
  const { context, tagName } = request;
  if (!tagName) throw new Error("Tag name is required.");
  const repo = git(context.repositoryPath);
  await validateRefName(repo, `refs/tags/${tagName}`, "tag");
  await repo.raw(["tag", tagName, context.commitSha]);
  return withSnapshot(context.repositoryPath, `Tag ${tagName} created.`);
}

export async function createAnnotatedTagAtCommit(
  request: BranchActionRequest,
): Promise<GitOperationResult> {
  const { context, tagName, tagMessage } = request;
  if (!tagName) throw new Error("Tag name is required.");
  if (!tagMessage) throw new Error("Tag message is required.");
  const repo = git(context.repositoryPath);
  await validateRefName(repo, `refs/tags/${tagName}`, "tag");
  await repo.raw(["tag", "-a", tagName, context.commitSha, "-m", tagMessage]);
  return withSnapshot(context.repositoryPath, `Annotated tag ${tagName} created.`);
}

export async function compareCommitWithWorkingDirectory(
  request: BranchActionRequest,
): Promise<GitOperationResult> {
  const { context } = request;
  const repo = git(context.repositoryPath);
  const [nameStatus, diff] = await Promise.all([
    repo.raw(["diff", "--name-status", context.commitSha]),
    repo.raw(["diff", context.commitSha]),
  ]);
  return {
    ok: true,
    message: "Diff loaded.",
    data: { nameStatus, diff },
  };
}

export async function explainBranchChanges(
  request: BranchActionRequest,
): Promise<GitOperationResult> {
  const { context } = request;
  const repo = git(context.repositoryPath);
  const base = context.upstream || "origin/main";
  const mergeBase = (await repo.raw(["merge-base", base, context.branchName])).trim();
  const [commits, diffStat, diff] = await Promise.all([
    repo.raw(["log", "--oneline", `${mergeBase}..${context.branchName}`]),
    repo.raw(["diff", "--stat", mergeBase, context.branchName]),
    repo.raw(["diff", mergeBase, context.branchName]),
  ]);
  return {
    ok: true,
    message: "Branch changes loaded.",
    data: {
      base,
      mergeBase,
      commits,
      diffStat,
      diff,
      summary: buildBranchExplanation(commits, diffStat),
    },
  };
}

export async function applyPatch(
  request: BranchActionRequest,
): Promise<GitOperationResult> {
  const { context, patch } = request;
  if (!patch?.trim()) throw new Error("Patch content is required.");
  const repo = git(context.repositoryPath);
  const isMailboxPatch = /^From [a-f0-9]{7,40} /m.test(patch) || /^Subject: /m.test(patch);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "gitcoso-patch-"));
  const patchPath = path.join(tempDir, "input.patch");
  try {
    await writeFile(patchPath, patch);
    await repo.raw(isMailboxPatch ? ["am", "-3", patchPath] : ["apply", "--check", patchPath]);
    if (!isMailboxPatch) {
      await repo.raw(["apply", patchPath]);
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
  return withSnapshot(context.repositoryPath, isMailboxPatch ? "Patch applied as commit." : "Patch applied.");
}

type BranchSummaryLike = {
  all: string[];
  current: string;
  branches: Record<
    string,
    {
      current: boolean;
      name: string;
      commit: string;
      label: string;
      tracking?: string;
      ahead?: number;
      behind?: number;
    }
  >;
};

function mapBranches(branchSummary: BranchSummaryLike): Branch[] {
  return branchSummary.all
    .filter((name) => !name.includes("HEAD ->"))
    .map((name) => {
      const cleanName = name.replace(/^remotes\//, "");
      const isRemote = name.startsWith("remotes/");
      const details =
        branchSummary.branches[name] ?? branchSummary.branches[cleanName];
      const remoteName = isRemote ? cleanName.split("/")[0] : getRemoteName(details?.tracking);
      return {
        name: cleanName,
        current:
          cleanName === branchSummary.current || Boolean(details?.current),
        kind: isRemote ? "remote" : "local",
        remoteName,
        upstream: details?.tracking,
        ahead: details?.ahead,
        behind: details?.behind,
        lastCommit: details?.commit,
      } satisfies Branch;
    })
    .sort(
      (a, b) =>
        Number(b.current) - Number(a.current) ||
        a.kind.localeCompare(b.kind) ||
        a.name.localeCompare(b.name),
    );
}

async function mapWorkingDirectoryStatus(
  repo: SimpleGit,
  status: {
    files: Array<{ path: string; index: string; working_dir: string }>;
    conflicted: string[];
  },
): Promise<WorkingDirectoryStatus> {
  const porcelain = await repo.raw(["status", "--porcelain=v1", "--renames", "-z"]);
  const parsed = parsePorcelainStatus(porcelain);
  const stagedFiles = parsed.stagedFiles;
  const unstagedFiles = parsed.unstagedFiles;

  return {
    hasUncommittedChanges: stagedFiles.length > 0 || unstagedFiles.length > 0 || status.conflicted.length > 0,
    stagedFiles,
    unstagedFiles,
    conflictedFiles: status.conflicted,
    rebaseInProgress: await isRebaseInProgress(repo),
    mergeInProgress: await isMergeInProgress(repo),
  };
}

function parsePorcelainStatus(output: string): Pick<WorkingDirectoryStatus, "stagedFiles" | "unstagedFiles"> {
  const entries = output.split("\0").filter(Boolean);
  const stagedFiles: ChangedFile[] = [];
  const unstagedFiles: ChangedFile[] = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const x = entry[0] ?? " ";
    const y = entry[1] ?? " ";
    let filePath = entry.slice(3);
    let oldPath: string | undefined;

    if (x === "R" || x === "C") {
      oldPath = entries[index + 1];
      index += 1;
    }

    if (entry.startsWith("?? ")) {
      unstagedFiles.push(mapStatusFile(filePath, "?", false));
      continue;
    }

    if (isConflictStatus(x, y)) {
      const conflicted = mapStatusFile(filePath, y === "D" ? "D" : "M", false);
      unstagedFiles.push({ ...conflicted, conflicted: true });
      continue;
    }

    if (x && x !== " ") {
      stagedFiles.push({ ...mapStatusFile(filePath, x, true), oldPath });
    }
    if (y && y !== " ") {
      unstagedFiles.push(mapStatusFile(filePath, y, false));
    }
  }

  return {
    stagedFiles: stagedFiles.sort((a, b) => a.path.localeCompare(b.path)),
    unstagedFiles: unstagedFiles.sort((a, b) => a.path.localeCompare(b.path)),
  };
}

function isConflictStatus(indexStatus: string, workingTreeStatus: string) {
  return ["DD", "AU", "UD", "UA", "DU", "AA", "UU"].includes(`${indexStatus}${workingTreeStatus}`);
}

function mapStatusFile(filePath: string, status: string, staged: boolean): ChangedFile {
  return {
    path: filePath,
    staged,
    status: status === "A"
      ? "added"
      : status === "D"
        ? "deleted"
        : status === "R"
          ? "renamed"
          : status === "C"
            ? "copied"
            : status === "M"
              ? "modified"
              : "unknown",
  };
}

function normalizeFolderPath(folderPath: string) {
  return folderPath === "." ? "." : folderPath.replace(/\/+$/, "");
}

async function isUntrackedFile(repoPath: string, filePath: string) {
  const status = await git(repoPath).status();
  return status.files.some((file) => file.path === filePath && file.working_dir === "?");
}

async function withSnapshot(repoPath: string, message: string): Promise<GitOperationResult> {
  return {
    ok: true,
    message,
    snapshot: await getRepositorySnapshot(repoPath),
  };
}

function assertLocalBranch(branchType: Branch["kind"], action: string) {
  if (branchType !== "local") {
    throw new Error(`${action} requires a local branch. Create a local tracking branch first.`);
  }
}

function assertUpstream(upstream: string | undefined, action: string) {
  if (!upstream) {
    throw new Error(`${action} requires an upstream. Use Set Upstream first.`);
  }
}

async function checkoutContextBranch(repo: SimpleGit, context: BranchActionRequest["context"]) {
  if (!context.isCheckedOut) {
    await repo.checkout(context.branchName);
  }
}

async function validateRefName(repo: SimpleGit, name: string, label: string) {
  try {
    await repo.raw(["check-ref-format", "--branch", name]);
  } catch {
    throw new Error(`Invalid ${label} name: ${name}`);
  }
}

async function isRebaseInProgress(repo: SimpleGit) {
  try {
    const gitDir = (await repo.raw(["rev-parse", "--path-format=absolute", "--git-dir"])).trim();
    return existsSync(path.join(gitDir, "rebase-merge")) || existsSync(path.join(gitDir, "rebase-apply"));
  } catch {
    return false;
  }
}

async function isMergeInProgress(repo: SimpleGit) {
  try {
    const gitDir = (await repo.raw(["rev-parse", "--path-format=absolute", "--git-dir"])).trim();
    return existsSync(path.join(gitDir, "MERGE_HEAD"));
  } catch {
    return false;
  }
}

async function hasHead(repo: SimpleGit) {
  return repo.raw(["rev-parse", "--verify", "HEAD"])
    .then(() => true)
    .catch(() => false);
}

function splitRemoteBranch(branchName: string, remoteName?: string) {
  const [first, ...rest] = branchName.split("/");
  return {
    remote: remoteName || first || "origin",
    branch: rest.length ? rest.join("/") : branchName,
  };
}

function getRemoteName(upstream?: string) {
  return upstream?.split("/")[0];
}

function normalizeGitError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^fatal:\s*/i, "").trim();
}

function normalizePushError(error: unknown) {
  const message = normalizeGitError(error);
  if (/Authentication failed|permission denied|could not read Username/i.test(message)) {
    return `Authentication failed. ${message}`;
  }
  if (/non-fast-forward|fetch first|rejected/i.test(message)) {
    return `Push rejected or non-fast-forward. Pull/rebase before pushing. ${message}`;
  }
  if (/Could not resolve host|failed to connect|repository not found/i.test(message)) {
    return `Remote is not reachable. ${message}`;
  }
  return message;
}

function buildBranchExplanation(commits: string, diffStat: string) {
  return [
    "Branch changes summary:",
    commits.trim() ? `Commits:\n${commits.trim()}` : "No branch-only commits found.",
    diffStat.trim() ? `Files:\n${diffStat.trim()}` : "No file changes found.",
  ].join("\n\n");
}

function parseCommitLog(output: string): CommitNode[] {
  const rows = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const laneByRef = new Map<string, number>();
  const laneByHash = new Map<string, number>();
  const activeLanes = new Set<number>();
  let nextLane = 0;

  const commits = rows.map((line) => {
    const [
      hash,
      shortHash,
      author,
      authorEmail,
      date,
      message,
      parentText,
      refText,
    ] = line.split("\x1f");
    const parents = parentText ? parentText.split(" ").filter(Boolean) : [];
    const refs = parseRefs(refText);
    const lane = pickStableLane(
      hash,
      refs,
      parents,
      laneByRef,
      laneByHash,
      activeLanes,
      nextLane,
    );
    if (lane >= nextLane) nextLane = lane + 1;
    activeLanes.add(lane);
    laneByHash.set(hash, lane);
    parents.forEach((parent) => {
      if (!laneByHash.has(parent)) laneByHash.set(parent, lane);
    });

    return {
      hash,
      shortHash: shortHash || hash.slice(0, 7),
      author,
      authorEmail,
      avatarUrl: getAvatarUrl(authorEmail),
      date,
      message,
      parents,
      refs,
      lane,
      color: branchColors[lane % branchColors.length],
    };
  });

  // Compact lanes: shift lanes left to fill gaps
  const usedLanes = [...new Set(commits.map((c) => c.lane))].sort(
    (a, b) => a - b,
  );
  const laneRemap = new Map(usedLanes.map((lane, index) => [lane, index]));
  for (const commit of commits) {
    commit.lane = laneRemap.get(commit.lane) ?? commit.lane;
    commit.color = branchColors[commit.lane % branchColors.length];
  }

  return commits;
}

function getAvatarUrl(email: string): string {
  const normalized = email.trim().toLowerCase();
  const githubUser = normalized.match(
    /^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/,
  )?.[1];
  if (githubUser) {
    return `https://github.com/${githubUser}.png?size=96`;
  }

  const hash = createHash("md5").update(normalized).digest("hex");
  return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=96`;
}

function parseRefs(refs?: string): string[] {
  if (!refs) {
    return [];
  }

  return refs
    .split(",")
    .map((ref) =>
      ref
        .trim()
        .replace(/^HEAD -> /, "")
        .replace(/^tag: /, ""),
    )
    .filter(Boolean);
}

function pickStableLane(
  hash: string,
  refs: string[],
  parents: string[],
  laneByRef: Map<string, number>,
  laneByHash: Map<string, number>,
  activeLanes: Set<number>,
  nextLane: number,
): number {
  const branchRef = refs.find((ref) => !ref.startsWith("tag:"));
  if (branchRef) {
    const existing = laneByRef.get(branchRef);
    if (existing !== undefined) return existing;

    // Try to reuse a freed lane, otherwise allocate next
    const lane = findFreeLane(activeLanes, nextLane);
    laneByRef.set(branchRef, lane);
    return lane;
  }

  const parentLane = parents
    .map((parent) => laneByHash.get(parent))
    .find((lane) => lane !== undefined);
  if (parentLane !== undefined) return parentLane;

  const currentLane = laneByHash.get(hash);
  if (currentLane !== undefined) return currentLane;

  return findFreeLane(activeLanes, nextLane);
}

function findFreeLane(activeLanes: Set<number>, nextLane: number): number {
  // Try to find the lowest unused lane
  for (let i = 0; i < nextLane; i++) {
    if (!activeLanes.has(i)) return i;
  }
  return nextLane;
}

function summarizeStatus(files: number, ahead: number, behind: number): string {
  const parts = [`${files} changed file${files === 1 ? "" : "s"}`];
  if (ahead > 0) {
    parts.push(`${ahead} ahead`);
  }
  if (behind > 0) {
    parts.push(`${behind} behind`);
  }
  return parts.join(" - ");
}

function parseCommitDetails(show: string, diff: string): CommitDetails {
  const lines = show.split(/\r?\n/);
  const [hash, shortHash, author, date, message] = lines;
  const files = lines
    .slice(5)
    .filter((line) => /^[ACDMR]\s+/.test(line))
    .map((line) => {
      const [rawStatus, ...paths] = line.split(/\s+/);
      return {
        path: paths.join(" -> "),
        status: mapStatus(rawStatus),
      } satisfies ChangedFile;
    });

  return {
    hash,
    shortHash,
    author,
    date,
    message,
    body: "",
    files,
    diff: diff.trim().slice(0, 8000),
  };
}

function mapStatus(status: string): ChangedFile["status"] {
  if (status.startsWith("A")) return "added";
  if (status.startsWith("M")) return "modified";
  if (status.startsWith("D")) return "deleted";
  if (status.startsWith("R")) return "renamed";
  if (status.startsWith("C")) return "copied";
  return "unknown";
}

function throwCheckoutError(error: unknown, branch: string): never {
  const message =
    error instanceof Error ? error.message : "Unable to checkout branch";
  if (
    message.includes(
      "Your local changes to the following files would be overwritten by checkout",
    )
  ) {
    throw new Error(
      JSON.stringify({
        type: "checkout-blocked",
        branch,
        files: parseCheckoutBlockedFiles(message),
        message: "Checkout blocked by local changes that would be overwritten.",
      }),
    );
  }

  throw new Error(message);
}

function parseCheckoutBlockedFiles(message: string): string[] {
  const marker =
    "Your local changes to the following files would be overwritten by checkout:";
  const start = message.indexOf(marker);
  if (start === -1) {
    return [];
  }

  const afterMarker = message.slice(start + marker.length);
  const end = afterMarker.indexOf(
    "Please commit your changes or stash them before you switch branches.",
  );
  const filesBlock = end === -1 ? afterMarker : afterMarker.slice(0, end);
  return filesBlock
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
