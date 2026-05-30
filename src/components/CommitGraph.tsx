import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FolderOpen, GitMerge } from "lucide-react";
import { formatDate } from "../lib/utils";
import { useRepositoryStore } from "../store/repositoryStore";
import { cn } from "../lib/utils";
import { Button } from "./ui/Button";
import type { BranchKind } from "../shared/types";

// ─── Constants ───────────────────────────────────────────────────────────────

const TOP_OFFSET = 20;
const LANE_WIDTH = 24;
const GRAPH_LEFT = 32;
const GRAPH_RIGHT_PADDING = 90;
const NODE_RADIUS = 7;
const NODE_RADIUS_SELECTED = 9;

type DensityMode = "compact" | "normal" | "expanded";
const DENSITY_ROW_HEIGHTS: Record<DensityMode, number> = {
  compact: 28,
  normal: 36,
  expanded: 46,
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
  const [hoveredLane, setHoveredLane] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{
    commit: Commit;
    x: number;
    y: number;
  } | null>(null);
  const [density, setDensity] = useState<DensityMode>("normal");
  const scrollRef = useRef<HTMLDivElement>(null);

  const rowHeight = DENSITY_ROW_HEIGHTS[density];
  const commits = snapshot.commits;
  const indexByHash = useMemo(
    () => new Map(commits.map((c, i) => [c.hash, i])),
    [commits],
  );
  const maxLane = useMemo(
    () => Math.max(0, ...commits.map((c) => c.lane)),
    [commits],
  );
  const graphWidth =
    GRAPH_LEFT + (maxLane + 1) * LANE_WIDTH + GRAPH_RIGHT_PADDING;
  const contentOffset = graphWidth;
  const minContentWidth = contentOffset + 760;
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

  if (!snapshot.path) {
    return (
      <div className="grid h-[calc(100vh-118px)] place-items-center px-8">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-accent-blue shadow-glow">
            <FolderOpen size={24} />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-slate-100">
            Open a Git repository folder
          </h2>
          <p className="mb-6 text-sm leading-6 text-slate-400">
            BranchFlow will read local and remote branches, then draw the real
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
      <div className="grid h-[calc(100vh-118px)] place-items-center px-8 text-center">
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
      className="graph-container h-[calc(100vh-64px)] overflow-auto bg-[#0c1018] focus:outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="relative" style={{ minWidth: minContentWidth }}>
        {/* Sticky Header */}
        <div
          className="sticky top-0 z-30 grid h-9 items-center border-b border-white/[0.06] bg-[#161b26]/95 text-[11px] font-semibold uppercase tracking-wide text-slate-400 backdrop-blur"
          style={{
            gridTemplateColumns: `${graphWidth}px minmax(320px,1fr) 112px 144px 110px`,
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
              maxLane={maxLane}
              rowHeight={rowHeight}
              hoveredLane={hoveredLane}
            />

            {/* Edges */}
            <GraphEdges
              commits={commits}
              indexByHash={indexByHash}
              rowHeight={rowHeight}
              hoveredLane={hoveredLane}
            />

            {/* Nodes */}
            <GraphNodes
              commits={commits}
              selectedHash={selectedHash}
              rowHeight={rowHeight}
              hoveredLane={hoveredLane}
              onHoverLane={setHoveredLane}
              onTooltip={setTooltip}
            />

            {/* Branch labels */}
            <BranchLabels
              commits={commits}
              branchKinds={
                new Map(snapshot.branches.map((b) => [b.name, b.kind]))
              }
              graphWidth={graphWidth}
              rowHeight={rowHeight}
            />
          </svg>

          {/* Row highlights (virtualised) */}
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const commit = commits[virtualRow.index];
            const selected = selectedHash === commit.hash;
            return (
              <div
                key={`hl-${commit.hash}`}
                className={cn(
                  "absolute left-0 right-3 border-y transition-colors duration-200",
                  selected
                    ? "border-sky-400/30 bg-sky-500/[0.12]"
                    : virtualRow.index % 2 === 0
                      ? "border-transparent bg-white/[0.015]"
                      : "border-transparent",
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
            return (
              <button
                key={commit.hash}
                onClick={() => setSelectedCommit(commit.hash)}
                onMouseEnter={() => setHoveredLane(commit.lane)}
                onMouseLeave={() => setHoveredLane(null)}
                className={cn(
                  "absolute right-3 z-20 grid items-center gap-3 rounded-md px-3 text-left transition-all duration-150",
                  selected
                    ? "text-white bg-sky-500/[0.08]"
                    : "text-slate-300 hover:text-white hover:bg-white/[0.03]",
                )}
                style={{
                  height: rowHeight - 4,
                  left: contentOffset,
                  top: TOP_OFFSET + index * rowHeight - rowHeight / 2 + 2,
                  gridTemplateColumns: "minmax(320px,1fr) 112px 144px 110px",
                }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {commit.parents.length > 1 ? (
                    <GitMerge size={12} className="shrink-0 text-amber-300" />
                  ) : null}
                  <span className="truncate text-[12px] font-semibold">
                    {commit.message}
                  </span>
                  {commit.refs.slice(0, 1).map((ref) => (
                    <span
                      key={ref}
                      className="max-w-24 shrink-0 truncate rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-semibold text-blue-200 border border-white/10"
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
  maxLane,
  rowHeight,
  hoveredLane,
}: {
  commits: Commit[];
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
        fill="#080c14"
        opacity="0.92"
      />
      {Array.from({ length: maxLane + 1 }, (_, lane) => {
        const laneCommits = commits
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => c.lane === lane);
        if (laneCommits.length === 0) return null;
        const first = laneCommits[0].i;
        const last = laneCommits[laneCommits.length - 1].i;
        const x = laneX(lane);
        const isHovered = hoveredLane === lane;
        return (
          <line
            key={`lane-${lane}`}
            x1={x}
            y1={rowY(first, rowHeight)}
            x2={x}
            y2={rowY(last, rowHeight)}
            stroke={laneColor(lane)}
            strokeWidth={isHovered ? "2" : "1.2"}
            opacity={hoveredLane === null ? "0.18" : isHovered ? "0.5" : "0.08"}
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
  rowHeight,
  hoveredLane,
}: {
  commits: Commit[];
  indexByHash: Map<string, number>;
  rowHeight: number;
  hoveredLane: number | null;
}) {
  return (
    <>
      {commits.map((commit, index) => {
        const fromX = laneX(commit.lane);
        const fromY = rowY(index, rowHeight);
        const parentEdges = commit.parents
          .map((p) => indexByHash.get(p))
          .filter((pi): pi is number => pi !== undefined && pi > index)
          .slice(0, 4);

        return parentEdges.map((parentIndex, edgeIndex) => {
          const parent = commits[parentIndex];
          const toX = laneX(parent.lane);
          const toY = rowY(parentIndex, rowHeight);
          const primary = edgeIndex === 0;
          const edgeLane = primary ? commit.lane : parent.lane;
          const dimmed =
            hoveredLane !== null &&
            hoveredLane !== edgeLane &&
            hoveredLane !== commit.lane;

          return (
            <path
              key={`${commit.hash}-${parent.hash}`}
              d={buildSmoothEdge(fromX, fromY, toX, toY)}
              stroke={primary ? commit.color : parent.color}
              strokeWidth={primary ? "2.2" : "1.6"}
              fill="none"
              opacity={dimmed ? "0.12" : primary ? "0.88" : "0.55"}
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
  rowHeight,
  hoveredLane,
  onHoverLane,
  onTooltip,
}: {
  commits: Commit[];
  selectedHash: string;
  rowHeight: number;
  hoveredLane: number | null;
  onHoverLane: (lane: number | null) => void;
  onTooltip: (t: { commit: Commit; x: number; y: number } | null) => void;
}) {
  return (
    <>
      {commits.map((commit, index) => {
        const x = laneX(commit.lane);
        const y = rowY(index, rowHeight);
        const selected = selectedHash === commit.hash;
        const isMerge = commit.parents.length > 1;
        const hasBranchRef = commit.refs.some((r) => !r.startsWith("tag:"));
        const dimmed = hoveredLane !== null && hoveredLane !== commit.lane;
        const r = selected ? NODE_RADIUS_SELECTED : NODE_RADIUS;

        return (
          <g
            key={commit.hash}
            className="pointer-events-auto cursor-pointer"
            style={{ opacity: dimmed ? 0.3 : 1, transition: "opacity 200ms" }}
            onMouseEnter={(e) => {
              onHoverLane(commit.lane);
              onTooltip({ commit, x: e.clientX, y: e.clientY });
            }}
            onMouseLeave={() => {
              onHoverLane(null);
              onTooltip(null);
            }}
          >
            {/* Outer glow for branch tips */}
            {hasBranchRef && !dimmed ? (
              <circle
                cx={x}
                cy={y}
                r={r + 4}
                fill="none"
                stroke={commit.color}
                strokeWidth="1.5"
                opacity="0.35"
                className="animate-pulse-subtle"
              />
            ) : null}

            {/* Main node */}
            <circle
              cx={x}
              cy={y}
              r={r}
              fill={`url(#node-gradient-${commit.lane % 12})`}
              stroke={commit.color}
              strokeWidth={selected ? 3 : isMerge ? 2.8 : 2}
              filter={selected ? "url(#node-glow)" : "url(#node-shadow)"}
            />

            {/* Double ring for merge commits */}
            {isMerge ? (
              <circle
                cx={x}
                cy={y}
                r={r + 3}
                fill="none"
                stroke={commit.color}
                strokeWidth="1.2"
                opacity="0.6"
                strokeDasharray="3 2"
              />
            ) : null}
          </g>
        );
      })}
    </>
  );
}

function BranchLabels({
  commits,
  branchKinds,
  graphWidth,
  rowHeight,
}: {
  commits: Commit[];
  branchKinds: Map<string, BranchKind>;
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
          const kindText = getKindText(tag.kinds);
          const isRemote = tag.kinds.has("remote") && !tag.kinds.has("local");
          const textLen = Math.min(tag.displayName.length, 14);
          const isBoth = tag.kinds.has("local") && tag.kinds.has("remote");
          const width = textLen * 6 + (isBoth ? 38 : 28);
          const x = Math.min(laneX(commit.lane) + 14, graphWidth - width - 6);
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
                rx="9"
                fill={commit.color}
                opacity="0.85"
              />
              <rect
                x={x}
                y={y}
                width={width}
                height="18"
                rx="9"
                fill="none"
                stroke="#ffffff"
                strokeWidth="0.5"
                opacity="0.15"
              />
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
              <text
                x={x + 17}
                y={y + 12.5}
                fill="#f8fafc"
                fontSize="9"
                fontWeight="700"
                fontFamily="ui-monospace, monospace"
              >
                {tag.displayName.slice(0, 14)}
              </text>
              <text
                x={x + width - kindText.length * 5.5 - 5}
                y={y + 12.5}
                fill="#c4e0ff"
                fontSize="7.5"
                fontWeight="800"
                opacity="0.7"
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
    .filter((ref) => !ref.startsWith("tag:"))
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
    "#8b5cf6",
    "#38bdf8",
    "#34d399",
    "#fb7185",
    "#fbbf24",
    "#a78bfa",
    "#22d3ee",
    "#f97316",
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
 * Build a smooth S-curve edge between two nodes.
 * Same lane → straight vertical line.
 * Cross lane → cubic Bézier with vertical tangents at both endpoints.
 */
function buildSmoothEdge(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
) {
  if (fromX === toX) return `M ${fromX} ${fromY} L ${toX} ${toY}`;

  const verticalDist = toY - fromY;
  const cp1Y = fromY + verticalDist * 0.35;
  const cp2Y = toY - verticalDist * 0.35;

  return `M ${fromX} ${fromY} C ${fromX} ${cp1Y}, ${toX} ${cp2Y}, ${toX} ${toY}`;
}
