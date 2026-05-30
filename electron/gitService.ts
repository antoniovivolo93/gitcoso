import path from "node:path";
import { createHash } from "node:crypto";
import { simpleGit, SimpleGit } from "simple-git";
import {
  branchColors,
  Branch,
  ChangedFile,
  CommitDetails,
  CommitNode,
  RepositorySnapshot,
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
      throw new Error("Selected folder is not a Git repository.");
    }

    const [branchSummary, logOutput, status] = await Promise.all([
      repo.branch(["-a"]),
      repo.raw([
        "log",
        "--all",
        "--topo-order",
        "--date=iso",
        "--decorate=short",
        "--max-count=250",
        "--pretty=format:%H%x1f%h%x1f%an%x1f%ae%x1f%ad%x1f%s%x1f%P%x1f%D",
      ]),
      repo.status(),
    ]);

    const branches = mapBranches(branchSummary);
    const commits = parseCommitLog(logOutput);

    return {
      path: repoPath,
      name: path.basename(repoPath),
      activeBranch: branchSummary.current || "detached",
      branches,
      commits,
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
    `BranchFlow: before checkout ${branch}`,
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
      return {
        name: cleanName,
        current:
          cleanName === branchSummary.current || Boolean(details?.current),
        kind: isRemote ? "remote" : "local",
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
