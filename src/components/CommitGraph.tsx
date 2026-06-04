import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FolderOpen, GitMerge } from "lucide-react";
import { formatDate } from "../lib/utils";
import { useRepositoryStore } from "../store/repositoryStore";
import { branchHiddenKey, useBranchVisibilityStore } from "../store/branchVisibilityStore";
import { cn } from "../lib/utils";
import type { Branch, BranchKind, CommitNode } from "../shared/types";
import { Button } from "./ui/Button";

// ─── Constants ───────────────────────────────────────────────────────────────

const TOP_OFFSET = 28;
const LANE_WIDTH = 20;
const GRAPH_LEFT = 28;
const GRAPH_RIGHT_PADDING = 126;
const NODE_RADIUS = 11;
const NODE_RADIUS_SELECTED = 14;

type DensityMode = "compact" | "normal" | "expanded";
const DENSITY_ROW_HEIGHTS: Record<DensityMode, number> = {
  compact: 34,
  normal: 44,
  expanded: 54,
};

// ─── Main Component ──────────────────────────────────────────────────────────

export function CommitGraph() {
  const {
    snapshot,
    selectedHash,
    setSelectedCommit,
    openRepository,
    loading,
    desktopReady,
  } = useRepositoryStore();
  const { hiddenBranches, focusedBranch } = useBranchVisibilityStore();
  const [hoveredLane, setHoveredLane] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{
    commit: Commit;
    x: number;
    y: number;
  } | null>(null);
  const [density, setDensity] = useState<DensityMode>("normal");
  const scrollRef = useRef<HTMLDivElement>(null);

  const rowHeight = DENSITY_ROW_HEIGHTS[density];
  const repoKey = snapshot.path ?? "no-repository";
  const visibleBranches = useMemo(
    () => snapshot.branches.filter((branch) => !hiddenBranches.has(branchHiddenKey(repoKey, branch.kind, branch.name))),
    [snapshot.branches, hiddenBranches, repoKey],
  );
  const branchKinds = useMemo(
    () => new Map(visibleBranches.map((branch) => [branch.name, branch.kind])),
    [visibleBranches],
  );
  const commits = useMemo(
    () => filterCommitsByVisibleBranches(snapshot.commits, snapshot.branches, hiddenBranches, repoKey),
    [snapshot.commits, snapshot.branches, hiddenBranches, repoKey],
  );
  const visualLaneByHash = useMemo(() => getCompactVisualLanes(snapshot.commits), [snapshot.commits]);
  const branchLane = useMemo(() => getBranchLaneMap(commits, visualLaneByHash), [commits, visualLaneByHash]);
  const focusedBranchLane = focusedBranch ? branchLane.get(focusedBranch) ?? null : null;
  const emphasisLane = hoveredLane ?? focusedBranchLane;
  const indexByHash = useMemo(
    () => new Map(commits.map((c, i) => [c.hash, i])),
    [commits],
  );
  const maxVisualLane = useMemo(
    () => Math.max(0, ...commits.map((commit) => getVisualLane(commit, visualLaneByHash))),
    [commits, visualLaneByHash],
  );
  const graphWidth =
    GRAPH_LEFT + (maxVisualLane + 1) * LANE_WIDTH + GRAPH_RIGHT_PADDING;
  const contentOffset = graphWidth;
  const height = commits.length * rowHeight + TOP_OFFSET * 2;

  // Virtualizer
  const virtualizer = useVirtualizer({
    count: commits.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!commits.length) return;
      const currentIndex = commits.findIndex((c) => c.hash === selectedHash);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(currentIndex + 1, commits.length - 1);
        setSelectedCommit(commits[next].hash);
        virtualizer.scrollToIndex(next, { align: "auto" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = Math.max(currentIndex - 1, 0);
        setSelectedCommit(commits[prev].hash);
        virtualizer.scrollToIndex(prev, { align: "auto" });
      }
    },
    [commits, selectedHash, setSelectedCommit, virtualizer],
  );

  // Scroll to selected commit when it changes externally
  useEffect(() => {
    if (!selectedHash) return;
    const idx = indexByHash.get(selectedHash);
    if (idx !== undefined) virtualizer.scrollToIndex(idx, { align: "auto" });
  }, [selectedHash, indexByHash, virtualizer]);

  useEffect(() => {
    if (!selectedHash || indexByHash.has(selectedHash) || !commits[0]) return;
    void setSelectedCommit(commits[0].hash);
  }, [commits, indexByHash, selectedHash, setSelectedCommit]);

  useEffect(() => {
    if (!snapshot.activeBranch || !commits.length) return;
    const activeIndex = commits.findIndex((commit) => commit.refs.includes(snapshot.activeBranch));
    if (activeIndex !== -1) {
      virtualizer.scrollToIndex(activeIndex, { align: "center" });
    }
  }, [commits, snapshot.activeBranch, virtualizer]);

  if (!snapshot.path) {
    return (
      <div className="grid h-full place-items-center px-8">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-accent-blue shadow-glow">
            <FolderOpen size={24} />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-slate-100">
            Open a Git repository folder
          </h2>
          <p className="mb-6 text-sm leading-6 text-slate-400">
            GitCoso will read local and remote branches, then draw the real
            commit tree from Git history.
          </p>
          {!desktopReady ? (
            <div className="mb-5 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm leading-6 text-amber-100">
              The folder picker is available only inside the Electron desktop
              window. Start the app with npm run dev.
            </div>
          ) : null}
          <Button
            icon={FolderOpen}
            variant="primary"
            onClick={openRepository}
            disabled={loading || !desktopReady}
          >
            Open repository folder
          </Button>
        </div>
      </div>
    );
  }

  if (commits.length === 0) {
    return (
      <div className="grid h-full place-items-center px-8 text-center">
        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-100">
            No commits found
          </h2>
          <p className="text-sm text-slate-400">
            This repository has no visible commits across local or remote
            branches.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="graph-container h-full overflow-auto bg-[#0c1018] focus:outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="relative min-w-0">
        {/* Sticky Header */}
        <div
          className="sticky top-0 z-30 grid h-9 items-center border-b border-white/[0.06] bg-[#161b26]/95 text-[11px] font-semibold uppercase tracking-wide text-slate-400 backdrop-blur"
          style={{
            gridTemplateColumns: `${graphWidth}px minmax(0,1fr) 86px 118px 82px`,
          }}
        >
          <span className="flex items-center gap-2 px-4">
            Graph
            <DensityToggle density={density} onChange={setDensity} />
          </span>
          <span>Description</span>
          <span>Commit</span>
          <span>Author</span>
          <span className="pr-4 text-right">Date</span>
        </div>

        {/* Virtualised Content */}
        <div
          className="relative"
          style={{ height: virtualizer.getTotalSize() + TOP_OFFSET * 2 }}
        >
          {/* SVG Graph Layer */}
          <svg
            className="absolute left-0 top-0 z-10 pointer-events-none"
            width={graphWidth}
            height={height}
            aria-hidden
          >
            <defs>
              <filter
                id="node-glow"
                x="-50%"
                y="-50%"
                width="200%"
                height="200%"
              >
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter
                id="node-shadow"
                x="-30%"
                y="-30%"
                width="160%"
                height="160%"
              >
                <feDropShadow
                  dx="0"
                  dy="1"
                  stdDeviation="2"
                  floodOpacity="0.4"
                />
              </filter>
              {Array.from({ length: 12 }, (_, i) => (
                <radialGradient key={`ng-${i}`} id={`node-gradient-${i}`}>
                  <stop offset="0%" stopColor="#1a2030" />
                  <stop
                    offset="100%"
                    stopColor={laneColor(i)}
                    stopOpacity="0.3"
                  />
                </radialGradient>
              ))}
            </defs>

            {/* Lane guide lines */}
            <GraphLaneGuides
              commits={commits}
              visualLaneByHash={visualLaneByHash}
              maxLane={maxVisualLane}
              rowHeight={rowHeight}
              hoveredLane={emphasisLane}
            />

            {/* Edges */}
            <GraphEdges
              commits={commits}
              indexByHash={indexByHash}
              visualLaneByHash={visualLaneByHash}
              rowHeight={rowHeight}
              hoveredLane={emphasisLane}
            />

            {/* Nodes */}
            <GraphNodes
              commits={commits}
              selectedHash={selectedHash}
              activeBranch={snapshot.activeBranch}
              visualLaneByHash={visualLaneByHash}
              rowHeight={rowHeight}
              hoveredLane={emphasisLane}
              onHoverLane={setHoveredLane}
              onTooltip={setTooltip}
            />

            {/* Branch labels */}
            <BranchLabels
              commits={commits}
              branchKinds={branchKinds}
              visualLaneByHash={visualLaneByHash}
              graphWidth={graphWidth}
              rowHeight={rowHeight}
            />
          </svg>

          {/* Row highlights (virtualised) */}
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const commit = commits[virtualRow.index];
            const selected = selectedHash === commit.hash;
            const visualLane = getVisualLane(commit, visualLaneByHash);
            return (
              <div
                key={`hl-${commit.hash}`}
                className={cn(
                  "absolute left-0 right-3 border-y transition-colors duration-200",
                  selected
                    ? "border-cyan-300/40 bg-cyan-400/[0.14] shadow-[inset_3px_0_0_rgba(34,211,238,0.9)]"
                    : virtualRow.index % 2 === 0
                      ? "border-transparent bg-white/[0.015]"
                      : "border-transparent",
                  emphasisLane !== null && visualLane !== emphasisLane && "opacity-45"
                )}
                style={{
                  top:
                    TOP_OFFSET + virtualRow.index * rowHeight - rowHeight / 2,
                  height: rowHeight,
                }}
              />
            );
          })}

          {/* Commit rows (virtualised) */}
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const commit = commits[virtualRow.index];
            const index = virtualRow.index;
            const selected = selectedHash === commit.hash;
            const visualLane = getVisualLane(commit, visualLaneByHash);
            return (
              <button
                key={commit.hash}
                onClick={() => setSelectedCommit(commit.hash)}
                onMouseEnter={() => setHoveredLane(visualLane)}
                onMouseLeave={() => setHoveredLane(null)}
                className={cn(
                  "absolute right-3 z-20 grid items-center gap-3 rounded-md px-3 text-left transition-all duration-150",
                  selected
                    ? "bg-cyan-400/[0.08] text-white"
                    : "text-slate-300 hover:bg-white/[0.04] hover:text-white",
                  emphasisLane !== null && visualLane !== emphasisLane && "opacity-55"
                )}
                style={{
                  height: rowHeight - 4,
                  left: contentOffset,
                  top: TOP_OFFSET + index * rowHeight - rowHeight / 2 + 2,
                  gridTemplateColumns: "minmax(0,1fr) 86px 118px 82px",
                }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {commit.parents.length > 1 ? (
                    <GitMerge size={12} className="shrink-0 text-amber-300" />
                  ) : null}
                  <span className="truncate text-[13px] font-semibold">
                    {commit.message}
                  </span>
                  {commit.refs.filter((ref) => isVisibleRef(ref, branchKinds)).slice(0, 1).map((ref) => (
                    <span
                      key={ref}
                      className="max-w-28 shrink-0 truncate rounded-full border border-white/10 bg-white/[0.08] px-2 py-0.5 text-[10px] font-semibold text-cyan-100"
                    >
                      {compactRef(ref)}
                    </span>
                  ))}
                </span>
                <span className="font-mono text-[11px] text-slate-500">
                  {commit.shortHash}
                </span>
                <span className="flex min-w-0 items-center gap-2 text-[11px] text-slate-300">
                  <img
                    src={commit.avatarUrl}
                    alt=""
                    className="h-5 w-5 shrink-0 rounded-full border border-white/10 object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <span className="truncate">{commit.author}</span>
                </span>
                <span className="truncate text-right text-[11px] text-slate-500">
                  {formatDate(commit.date)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip ? (
        <div
          className="pointer-events-none fixed z-50 max-w-xs rounded-lg border border-white/10 bg-[#1a1f2e]/95 px-3 py-2.5 shadow-xl backdrop-blur graph-tooltip"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
        >
          <p className="mb-1 text-[11px] font-semibold text-white leading-tight">
            {tooltip.commit.message}
          </p>
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span className="font-mono text-sky-300">
              {tooltip.commit.shortHash}
            </span>
            <span>&middot;</span>
            <span>{tooltip.commit.author}</span>
            <span>&middot;</span>
            <span>{formatDate(tooltip.commit.date)}</span>
          </div>
          {tooltip.commit.parents.length > 1 ? (
            <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-300">
              <GitMerge size={10} />
              <span>
                Merge commit ({tooltip.commit.parents.length} parents)
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

type Commit = ReturnType<
  typeof useRepositoryStore.getState
>["snapshot"]["commits"][number];

function DensityToggle({
  density,
  onChange,
}: {
  density: DensityMode;
  onChange: (d: DensityMode) => void;
}) {
  const modes: DensityMode[] = ["compact", "normal", "expanded"];
  const labels: Record<DensityMode, string> = {
    compact: "S",
    normal: "M",
    expanded: "L",
  };
  return (
    <div className="ml-auto flex rounded-md border border-white/10 overflow-hidden">
      {modes.map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={cn(
            "px-1.5 py-0.5 text-[9px] font-bold transition-colors",
            density === m
              ? "bg-sky-500/30 text-sky-200"
              : "text-slate-500 hover:text-slate-300",
          )}
        >
          {labels[m]}
        </button>
      ))}
    </div>
  );
}

function GraphLaneGuides({
  commits,
  visualLaneByHash,
  maxLane,
  rowHeight,
  hoveredLane,
}: {
  commits: Commit[];
  visualLaneByHash: Map<string, number>;
  maxLane: number;
  rowHeight: number;
  hoveredLane: number | null;
}) {
  return (
    <>
      <rect
        x="0"
        y="0"
        width={GRAPH_LEFT + (maxLane + 1) * LANE_WIDTH + GRAPH_RIGHT_PADDING}
        height="100%"
        fill="#080b12"
      />
      {Array.from({ length: maxLane + 1 }, (_, lane) => {
        const laneCommits = commits
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => getVisualLane(c, visualLaneByHash) === lane);
        if (laneCommits.length === 0) return null;
        const first = laneCommits[0].i;
        const last = laneCommits[laneCommits.length - 1].i;
        const x = laneX(lane);
        const isHovered = hoveredLane === lane;
        return (
          <line
            key={`lane-${lane}`}
            x1={x}
            y1={Math.max(8, rowY(first, rowHeight) - rowHeight * 0.35)}
            x2={x}
            y2={rowY(last, rowHeight) + rowHeight * 0.35}
            stroke={laneColor(lane)}
            strokeWidth={isHovered ? "3.4" : "2.1"}
            opacity={hoveredLane === null ? "0.28" : isHovered ? "0.72" : "0.08"}
            strokeLinecap="round"
            className="transition-opacity duration-200"
          />
        );
      })}
    </>
  );
}

function GraphEdges({
  commits,
  indexByHash,
  visualLaneByHash,
  rowHeight,
  hoveredLane,
}: {
  commits: Commit[];
  indexByHash: Map<string, number>;
  visualLaneByHash: Map<string, number>;
  rowHeight: number;
  hoveredLane: number | null;
}) {
  return (
    <>
      {commits.map((commit, index) => {
        const commitLane = getVisualLane(commit, visualLaneByHash);
        const fromX = laneX(commitLane);
        const fromY = rowY(index, rowHeight);
        const parentEdges = commit.parents
          .map((p) => indexByHash.get(p))
          .filter((pi): pi is number => pi !== undefined && pi > index)
          .slice(0, 4);

        return parentEdges.map((parentIndex, edgeIndex) => {
          const parent = commits[parentIndex];
          const parentLane = getVisualLane(parent, visualLaneByHash);
          const toX = laneX(parentLane);
          const toY = rowY(parentIndex, rowHeight);
          const primary = edgeIndex === 0;
          const edgeLane = primary ? commitLane : parentLane;
          const dimmed =
            hoveredLane !== null &&
            hoveredLane !== edgeLane &&
            hoveredLane !== commitLane;

          return (
            <path
              key={`${commit.hash}-${parent.hash}`}
              d={buildSmoothEdge(fromX, fromY, toX, toY)}
              stroke={primary ? commit.color : parent.color}
              strokeWidth={primary ? "3" : "2.4"}
              fill="none"
              opacity={dimmed ? "0.12" : primary ? "0.95" : "0.7"}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-opacity duration-200"
            />
          );
        });
      })}
    </>
  );
}

function GraphNodes({
  commits,
  selectedHash,
  activeBranch,
  visualLaneByHash,
  rowHeight,
  hoveredLane,
  onHoverLane,
  onTooltip,
}: {
  commits: Commit[];
  selectedHash: string;
  activeBranch: string;
  visualLaneByHash: Map<string, number>;
  rowHeight: number;
  hoveredLane: number | null;
  onHoverLane: (lane: number | null) => void;
  onTooltip: (t: { commit: Commit; x: number; y: number } | null) => void;
}) {
  return (
    <>
      {commits.map((commit, index) => {
        const visualLane = getVisualLane(commit, visualLaneByHash);
        const x = laneX(visualLane);
        const y = rowY(index, rowHeight);
        const selected = selectedHash === commit.hash;
        const isMerge = commit.parents.length > 1;
        const hasBranchRef = commit.refs.some((r) => !r.startsWith("tag:"));
        const isHead = commit.refs.includes(activeBranch);
        const dimmed = hoveredLane !== null && hoveredLane !== visualLane;
        const r = selected ? NODE_RADIUS_SELECTED : isHead ? NODE_RADIUS + 1.8 : NODE_RADIUS;

        return (
          <g
            key={commit.hash}
            className="pointer-events-auto cursor-pointer"
            style={{ opacity: dimmed ? 0.3 : 1, transition: "opacity 200ms" }}
            onMouseEnter={(e) => {
              onHoverLane(visualLane);
              onTooltip({ commit, x: e.clientX, y: e.clientY });
            }}
            onMouseLeave={() => {
              onHoverLane(null);
              onTooltip(null);
            }}
          >
            {/* Outer glow for branch tips */}
            {(hasBranchRef || isHead) && !dimmed ? (
              <circle
                cx={x}
                cy={y}
                r={r + 5}
                fill="none"
                stroke={commit.color}
                strokeWidth={isHead ? "2" : "1.5"}
                opacity={isHead ? "0.55" : "0.35"}
                className="animate-pulse-subtle"
              />
            ) : null}

            {/* Main node */}
            <clipPath id={`avatar-clip-${commit.hash}`}>
              <circle cx={x} cy={y} r={Math.max(1, r - 1.4)} />
            </clipPath>
            <circle
              cx={x}
              cy={y}
              r={r}
              fill="#111827"
              stroke={commit.color}
              strokeWidth={selected ? 3.2 : isHead ? 2.8 : isMerge ? 2.6 : 2.1}
              filter={selected ? "url(#node-glow)" : "url(#node-shadow)"}
            />
            <image
              href={commit.avatarUrl}
              x={x - r + 1.4}
              y={y - r + 1.4}
              width={(r - 1.4) * 2}
              height={(r - 1.4) * 2}
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#avatar-clip-${commit.hash})`}
              opacity={dimmed ? "0.5" : "0.95"}
            />
            <circle
              cx={x}
              cy={y}
              r={r}
              fill="none"
              stroke={commit.color}
              strokeWidth={selected ? 3.2 : isHead ? 2.8 : isMerge ? 2.6 : 2.1}
            />

            {isMerge ? (
              <path
                d={`M ${x - 3.2} ${y - 1.8} C ${x - 1.3} ${y - 4.5}, ${x + 2.8} ${y - 4.2}, ${x + 3.4} ${y - 1.2} M ${x - 3.2} ${y + 2.4} C ${x - 0.8} ${y - 0.4}, ${x + 2.8} ${y - 0.2}, ${x + 3.4} ${y + 2.8}`}
                fill="none"
                stroke="#f8fafc"
                strokeWidth="1.1"
                opacity="0.8"
                strokeLinecap="round"
              />
            ) : null}
            {isHead && !isMerge ? <circle cx={x + r - 2.2} cy={y + r - 2.2} r="2.6" fill="#f8fafc" stroke={commit.color} strokeWidth="1" opacity="0.95" /> : null}
          </g>
        );
      })}
    </>
  );
}

function BranchLabels({
  commits,
  branchKinds,
  visualLaneByHash,
  graphWidth,
  rowHeight,
}: {
  commits: Commit[];
  branchKinds: Map<string, BranchKind>;
  visualLaneByHash: Map<string, number>;
  graphWidth: number;
  rowHeight: number;
}) {
  const seenKeys = new Set<string>();

  return (
    <>
      {commits.flatMap((commit, index) => {
        const tags = groupBranchTags(commit.refs, branchKinds)
          .filter((tag) => {
            if (seenKeys.has(tag.displayName)) return false;
            seenKeys.add(tag.displayName);
            return true;
          })
          .slice(0, 2);

        return tags.map((tag, tagIndex) => {
          const isRemote = tag.kinds.has("remote") && !tag.kinds.has("local");
          const isLocal = tag.kinds.has("local") && !tag.kinds.has("remote");
          const textLen = Math.min(tag.displayName.length, 14);
          const isBoth = tag.kinds.has("local") && tag.kinds.has("remote");
          const kindText = isBoth ? "L+R" : isRemote ? "REM" : "LOC";
          const width = textLen * 6.1 + (isBoth ? 54 : isRemote ? 48 : 44);
          const x = Math.min(laneX(getVisualLane(commit, visualLaneByHash)) + 12, graphWidth - width - 6);
          const y = rowY(index, rowHeight) - 9 + tagIndex * 20;

          return (
            <g
              key={`${commit.hash}-${tag.displayName}`}
              className="pointer-events-none"
            >
              <rect
                x={x}
                y={y}
                width={width}
                height="18"
                rx="6"
                fill={isRemote ? "#101826" : commit.color}
                opacity={isRemote ? "0.88" : "0.9"}
              />
              <rect
                x={x}
                y={y}
                width={width}
                height="18"
                rx="6"
                fill="none"
                stroke={isRemote ? commit.color : "#ffffff"}
                strokeWidth={isRemote ? "1.4" : isBoth ? "1" : "0.5"}
                strokeDasharray={isRemote ? "3 2" : undefined}
                opacity={isRemote ? "0.9" : isBoth ? "0.42" : "0.18"}
              />
              {isBoth ? (
                <rect
                  x={x + 2}
                  y={y + 2}
                  width={width - 4}
                  height="14"
                  rx="4"
                  fill="none"
                  stroke="#ecfeff"
                  strokeWidth="0.7"
                  strokeDasharray="3 2"
                  opacity="0.7"
                />
              ) : null}
              {/* Icon */}
              {isRemote ? (
                <g transform={`translate(${x + 5}, ${y + 4})`}>
                  <circle
                    cx="5"
                    cy="5"
                    r="3.5"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="1"
                    opacity="0.8"
                  />
                  <line
                    x1="5"
                    y1="1.5"
                    x2="5"
                    y2="0"
                    stroke="#fff"
                    strokeWidth="0.8"
                    opacity="0.8"
                  />
                </g>
              ) : (
                <g transform={`translate(${x + 5}, ${y + 4})`}>
                  <line
                    x1="5"
                    y1="10"
                    x2="5"
                    y2="2"
                    stroke="#fff"
                    strokeWidth="1.2"
                    opacity="0.8"
                  />
                  <path
                    d="M 5 2 Q 5 0 7 0"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="1.2"
                    opacity="0.8"
                  />
                </g>
              )}
              {isBoth ? (
                <g transform={`translate(${x + 12}, ${y + 4})`}>
                  <circle
                    cx="5"
                    cy="5"
                    r="3.2"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="0.9"
                    opacity="0.88"
                  />
                </g>
              ) : null}
              <text
                x={x + (isBoth ? 24 : 17)}
                y={y + 12.5}
                fill="#f8fafc"
                fontSize="9"
                fontWeight="700"
                fontFamily="ui-monospace, monospace"
              >
                {tag.displayName.slice(0, 14)}
              </text>
              <text
                x={x + width - kindText.length * 4.8 - 5}
                y={y + 12.5}
                fill={isLocal ? "#052e2f" : "#ecfeff"}
                fontSize="7.2"
                fontWeight="900"
                opacity={isLocal ? "0.72" : "0.88"}
              >
                {kindText}
              </text>
            </g>
          );
        });
      })}
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type BranchTag = {
  displayName: string;
  kinds: Set<BranchKind>;
  refs: string[];
};

function groupBranchTags(
  refs: string[],
  branchKinds: Map<string, BranchKind>,
): BranchTag[] {
  const tags = new Map<string, BranchTag>();
  refs
    .filter((ref) => isVisibleRef(ref, branchKinds))
    .forEach((ref) => {
      const kind = getRefKind(ref, branchKinds);
      const displayName = getBranchDisplayName(ref, kind);
      const tag = tags.get(displayName) ?? {
        displayName,
        kinds: new Set<BranchKind>(),
        refs: [],
      };
      tag.kinds.add(kind);
      tag.refs.push(ref);
      tags.set(displayName, tag);
    });
  return [...tags.values()].sort(
    (a, b) => Number(b.kinds.size) - Number(a.kinds.size),
  );
}

type LaneInterval = {
  lane: number;
  start: number;
  end: number;
  priority: number;
};

function getCompactVisualLanes(commits: CommitNode[]) {
  const intervals = getLaneIntervals(commits);
  const visualLaneByDataLane = new Map<number, number>();
  const visualLaneEnd: number[] = [];

  intervals.forEach((interval) => {
    const freeLane = visualLaneEnd.findIndex((end) => end < interval.start);
    const visualLane = freeLane === -1 ? visualLaneEnd.length : freeLane;
    visualLaneEnd[visualLane] = interval.end;
    visualLaneByDataLane.set(interval.lane, visualLane);
  });

  return new Map(commits.map((commit) => [commit.hash, visualLaneByDataLane.get(commit.lane) ?? 0]));
}

function getLaneIntervals(commits: CommitNode[]): LaneInterval[] {
  const intervals = new Map<number, LaneInterval>();
  const indexByHash = new Map(commits.map((commit, index) => [commit.hash, index]));

  commits.forEach((commit, index) => {
    const interval = intervals.get(commit.lane) ?? {
      lane: commit.lane,
      start: index,
      end: index,
      priority: Number.MAX_SAFE_INTEGER,
    };

    interval.start = Math.min(interval.start, index);
    interval.end = Math.max(interval.end, index);
    if (commit.refs.some((ref) => ref === "main" || ref === "master" || ref.endsWith("/main") || ref.endsWith("/master"))) {
      interval.priority = Math.min(interval.priority, 0);
    } else if (commit.refs.some((ref) => !ref.startsWith("tag:"))) {
      interval.priority = Math.min(interval.priority, 1);
    }

    commit.parents.forEach((parentHash) => {
      const parentIndex = indexByHash.get(parentHash);
      if (parentIndex !== undefined) {
        interval.end = Math.max(interval.end, parentIndex);
      }
    });

    intervals.set(commit.lane, interval);
  });

  return [...intervals.values()].sort(
    (a, b) =>
      a.start - b.start ||
      a.priority - b.priority ||
      a.end - b.end ||
      a.lane - b.lane,
  );
}

function getVisualLane(commit: CommitNode, visualLaneByHash: Map<string, number>) {
  return visualLaneByHash.get(commit.hash) ?? 0;
}

function getBranchLaneMap(commits: CommitNode[], visualLaneByHash: Map<string, number>) {
  const branchLane = new Map<string, number>();
  commits.forEach((commit) => {
    const visualLane = getVisualLane(commit, visualLaneByHash);
    commit.refs
      .filter((ref) => !ref.startsWith("tag:"))
      .forEach((ref) => branchLane.set(ref, visualLane));
  });
  return branchLane;
}

function filterCommitsByVisibleBranches(
  commits: CommitNode[],
  branches: Branch[],
  hiddenBranches: Set<string>,
  repoKey: string,
) {
  if (!branches.length) return commits;

  const hiddenBranchNames = new Set(
    branches
      .filter((branch) => hiddenBranches.has(branchHiddenKey(repoKey, branch.kind, branch.name)))
      .map((branch) => branch.name),
  );
  if (!hiddenBranchNames.size) return commits;

  const visibleBranchNames = new Set(
    branches
      .filter((branch) => !hiddenBranches.has(branchHiddenKey(repoKey, branch.kind, branch.name)))
      .map((branch) => branch.name),
  );
  const byHash = new Map(commits.map((commit) => [commit.hash, commit]));
  const hiddenTips = getBranchTipHashes(commits, branches, hiddenBranchNames);
  if (!hiddenTips.size) return commits;

  const visibleTips = getBranchTipHashes(commits, branches, visibleBranchNames);
  const hiddenReachable = collectReachableCommits(hiddenTips, byHash);
  const visibleReachable = collectReachableCommits(visibleTips, byHash);

  return commits.filter((commit) => !hiddenReachable.has(commit.hash) || visibleReachable.has(commit.hash));
}

function getBranchTipHashes(
  commits: CommitNode[],
  branches: Branch[],
  branchNames: Set<string>,
) {
  const tips = new Set<string>();
  const branchByName = new Map(branches.map((branch) => [branch.name, branch]));

  commits.forEach((commit) => {
    commit.refs.forEach((ref) => {
      if (branchNames.has(ref)) {
        tips.add(commit.hash);
      }
    });
  });

  branchNames.forEach((name) => {
    const lastCommit = branchByName.get(name)?.lastCommit;
    if (lastCommit) {
      tips.add(lastCommit);
    }
  });

  return tips;
}

function collectReachableCommits(tips: Set<string>, byHash: Map<string, CommitNode>) {
  const reachable = new Set<string>();
  const stack = [...tips];

  while (stack.length) {
    const hash = stack.pop();
    if (!hash || reachable.has(hash)) continue;
    const commit = byHash.get(hash);
    if (!commit) continue;
    reachable.add(hash);
    stack.push(...commit.parents);
  }

  return reachable;
}

function isVisibleRef(ref: string, branchKinds: Map<string, BranchKind>) {
  return !ref.startsWith("tag:") && branchKinds.has(ref);
}

function getRefKind(
  ref: string,
  branchKinds: Map<string, BranchKind>,
): BranchKind {
  const knownKind = branchKinds.get(ref);
  if (knownKind) return knownKind;
  return ref.includes("/") ? "remote" : "local";
}

function getBranchDisplayName(ref: string, kind: BranchKind): string {
  if (kind === "remote") return ref.replace(/^origin\//, "");
  return compactRef(ref);
}

function getKindText(kinds: Set<BranchKind>) {
  if (kinds.has("local") && kinds.has("remote")) return "L+R";
  if (kinds.has("remote")) return "R";
  return "L";
}

function laneX(lane: number) {
  return GRAPH_LEFT + lane * LANE_WIDTH;
}

function rowY(index: number, rowHeight: number) {
  return TOP_OFFSET + index * rowHeight;
}

function laneColor(lane: number) {
  const colors = [
    "#38bdf8",
    "#c084fc",
    "#34d399",
    "#fb7185",
    "#f59e0b",
    "#22d3ee",
    "#a78bfa",
    "#4ade80",
    "#e879f9",
    "#60a5fa",
    "#facc15",
  ];
  return colors[lane % colors.length];
}

function compactRef(ref: string) {
  return ref
    .replace(/^origin\//, "")
    .replace(/^refs\/heads\//, "")
    .slice(0, 18);
}

/**
 * Build a compact lane change: short curve first, then straight vertical line.
 */
function buildSmoothEdge(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
) {
  if (fromX === toX) return `M ${fromX} ${fromY} L ${toX} ${toY}`;

  const verticalDist = toY - fromY;
  const curveHeight = Math.min(Math.max(Math.abs(verticalDist) * 0.28, 14), 30);
  const curveEndY = fromY + Math.sign(verticalDist || 1) * curveHeight;
  const cp1Y = fromY + (curveEndY - fromY) * 0.45;
  const cp2Y = fromY + (curveEndY - fromY) * 0.75;

  return `M ${fromX} ${fromY} C ${fromX} ${cp1Y}, ${toX} ${cp2Y}, ${toX} ${curveEndY} L ${toX} ${toY}`;
}
