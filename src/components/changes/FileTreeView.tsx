import { ChevronRight, Eye, File, Folder, FolderInput, FolderOutput, RotateCcw, Undo2 } from "lucide-react";
import type { ChangedFile } from "../../shared/types";
import { cn } from "../../lib/utils";
import { StatusBadge } from "./FilePathView";

export type TreeNode = {
  path: string;
  name: string;
  files: ChangedFile[];
  folders: TreeNode[];
  count: number;
};

type FileTreeViewProps = {
  files: ChangedFile[];
  mode: "unstaged" | "staged";
  expandedFolders: Set<string>;
  onToggleFolder: (folderPath: string) => void;
  onStageFile?: (filePath: string) => void;
  onStageFolder?: (folderPath: string) => void;
  onUnstageFile?: (filePath: string) => void;
  onUnstageFolder?: (folderPath: string) => void;
  onDiscard?: (filePath: string) => void;
  onDiff: (filePath: string, staged: boolean) => void;
  onOpenFile?: (filePath: string) => void;
};

export function FileTreeView({
  files,
  mode,
  expandedFolders,
  onToggleFolder,
  onStageFile,
  onStageFolder,
  onUnstageFile,
  onUnstageFolder,
  onDiscard,
  onDiff,
  onOpenFile,
}: FileTreeViewProps) {
  if (!files.length) {
    return (
      <p className="px-3 py-3 text-[12px] text-slate-600">
        {mode === "unstaged" ? "No unstaged changes." : "No staged files."}
      </p>
    );
  }

  const root = buildTree(files);

  return (
    <div className="py-1">
      {root.folders.map((folder) => (
        <FolderNodeView
          key={folder.path}
          node={folder}
          depth={0}
          mode={mode}
          expandedFolders={expandedFolders}
          onToggleFolder={onToggleFolder}
          onStageFile={onStageFile}
          onStageFolder={onStageFolder}
          onUnstageFile={onUnstageFile}
          onUnstageFolder={onUnstageFolder}
          onDiscard={onDiscard}
          onDiff={onDiff}
          onOpenFile={onOpenFile}
        />
      ))}
      {root.files.map((file) => (
        <FileNodeView
          key={`${mode}-${file.status}-${file.path}`}
          file={file}
          depth={0}
          mode={mode}
          onStageFile={onStageFile}
          onUnstageFile={onUnstageFile}
          onDiscard={onDiscard}
          onDiff={onDiff}
          onOpenFile={onOpenFile}
        />
      ))}
    </div>
  );
}

function FolderNodeView({
  node,
  depth,
  mode,
  expandedFolders,
  onToggleFolder,
  onStageFile,
  onStageFolder,
  onUnstageFile,
  onUnstageFolder,
  onDiscard,
  onDiff,
  onOpenFile,
}: {
  node: TreeNode;
  depth: number;
  mode: "unstaged" | "staged";
  expandedFolders: Set<string>;
  onToggleFolder: (folderPath: string) => void;
  onStageFile?: (filePath: string) => void;
  onStageFolder?: (folderPath: string) => void;
  onUnstageFile?: (filePath: string) => void;
  onUnstageFolder?: (folderPath: string) => void;
  onDiscard?: (filePath: string) => void;
  onDiff: (filePath: string, staged: boolean) => void;
  onOpenFile?: (filePath: string) => void;
}) {
  const expanded = expandedFolders.has(node.path);

  return (
    <div>
      <div
        className="grid h-8 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2 text-[12px] text-slate-400 hover:bg-white/[0.04]"
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <button
          type="button"
          onClick={() => onToggleFolder(node.path)}
          className="flex min-w-0 items-center gap-1.5 text-left"
          title={node.path}
        >
          <ChevronRight size={13} className={cn("shrink-0 text-slate-500 transition", expanded && "rotate-90")} />
          <Folder size={13} className="shrink-0 text-cyan-300/70" />
          <span className="min-w-0 truncate">{node.name}</span>
          <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-500">{node.count}</span>
        </button>
        <button
          type="button"
          onClick={() => mode === "unstaged" ? onStageFolder?.(node.path) : onUnstageFolder?.(node.path)}
          className="grid h-6 w-6 place-items-center rounded text-slate-500 transition hover:bg-white/[0.08] hover:text-slate-100"
          title={mode === "unstaged" ? "Stage folder" : "Unstage folder"}
        >
          {mode === "unstaged" ? <FolderInput size={13} /> : <FolderOutput size={13} />}
        </button>
      </div>
      {expanded ? (
        <>
          {node.folders.map((folder) => (
            <FolderNodeView
              key={folder.path}
              node={folder}
              depth={depth + 1}
              mode={mode}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
              onStageFile={onStageFile}
              onStageFolder={onStageFolder}
              onUnstageFile={onUnstageFile}
              onUnstageFolder={onUnstageFolder}
              onDiscard={onDiscard}
              onDiff={onDiff}
              onOpenFile={onOpenFile}
            />
          ))}
          {node.files.map((file) => (
            <FileNodeView
              key={`${mode}-${file.status}-${file.path}`}
              file={file}
              depth={depth + 1}
              mode={mode}
              onStageFile={onStageFile}
              onUnstageFile={onUnstageFile}
              onDiscard={onDiscard}
              onDiff={onDiff}
              onOpenFile={onOpenFile}
            />
          ))}
        </>
      ) : null}
    </div>
  );
}

function FileNodeView({
  file,
  depth,
  mode,
  onStageFile,
  onUnstageFile,
  onDiscard,
  onDiff,
  onOpenFile,
}: {
  file: ChangedFile;
  depth: number;
  mode: "unstaged" | "staged";
  onStageFile?: (filePath: string) => void;
  onUnstageFile?: (filePath: string) => void;
  onDiscard?: (filePath: string) => void;
  onDiff: (filePath: string, staged: boolean) => void;
  onOpenFile?: (filePath: string) => void;
}) {
  return (
    <div
      className="grid h-8 grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2 px-2 text-[12px] text-slate-300 hover:bg-white/[0.045]"
      style={{ paddingLeft: 12 + depth * 14 }}
    >
      <StatusBadge file={file} />
      <button
        type="button"
        onClick={() => onDiff(file.path, mode === "staged")}
        className="flex min-w-0 items-center gap-1.5 text-left"
        title={file.oldPath ? `${file.oldPath} -> ${file.path}` : file.path}
      >
        <File size={12} className="shrink-0 text-slate-600" />
        <span className="min-w-0 truncate">{basename(file.path)}</span>
      </button>
      <div className="flex items-center gap-1">
        <TreeIconButton title="Open diff" onClick={() => onDiff(file.path, mode === "staged")} icon={Eye} />
        {mode === "staged" ? (
          <>
            <TreeIconButton title="Open file" onClick={() => onOpenFile?.(file.path)} icon={FolderOutput} />
            <TreeIconButton title="Unstage file" onClick={() => onUnstageFile?.(file.path)} icon={Undo2} />
          </>
        ) : (
          <>
            <TreeIconButton title="Stage file" onClick={() => onStageFile?.(file.path)} icon={FolderInput} />
            <TreeIconButton title="Discard changes" onClick={() => onDiscard?.(file.path)} icon={RotateCcw} danger />
          </>
        )}
      </div>
    </div>
  );
}

function TreeIconButton({
  title,
  onClick,
  icon: Icon,
  danger,
}: {
  title: string;
  onClick: () => void;
  icon: typeof Eye;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "grid h-6 w-6 place-items-center rounded text-slate-500 transition hover:bg-white/[0.08] hover:text-slate-100",
        danger && "hover:bg-rose-500/12 hover:text-rose-200"
      )}
      title={title}
    >
      <Icon size={13} />
    </button>
  );
}

export function buildTree(files: ChangedFile[]): TreeNode {
  const root: TreeNode = { path: ".", name: ".", files: [], folders: [], count: files.length };
  const folderByPath = new Map<string, TreeNode>([[".", root]]);

  files.forEach((file) => {
    const parts = file.path.split("/");
    if (parts.length === 1) {
      root.files.push(file);
      return;
    }

    let current = root;
    let currentPath = "";
    parts.slice(0, -1).forEach((part) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let folder = folderByPath.get(currentPath);
      if (!folder) {
        folder = { path: currentPath, name: part, files: [], folders: [], count: 0 };
        folderByPath.set(currentPath, folder);
        current.folders.push(folder);
      }
      folder.count += 1;
      current = folder;
    });
    current.files.push(file);
  });

  sortNode(root);
  return root;
}

function sortNode(node: TreeNode) {
  node.folders.sort((a, b) => a.name.localeCompare(b.name));
  node.files.sort((a, b) => a.path.localeCompare(b.path));
  node.folders.forEach(sortNode);
}

function basename(filePath: string) {
  const index = filePath.lastIndexOf("/");
  return index === -1 ? filePath : filePath.slice(index + 1);
}
