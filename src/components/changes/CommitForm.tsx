import { ChevronDown, GitCommitHorizontal } from "lucide-react";
import type { CommitOptions } from "../../shared/types";
import { cn } from "../../lib/utils";

type CommitFormProps = {
  summary: string;
  description: string;
  amendPreviousCommit: boolean;
  commitOptions: CommitOptions;
  optionsExpanded: boolean;
  canCommit: boolean;
  blockingReason: string | null;
  pushedWarning: boolean;
  loading: boolean;
  onSummaryChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onAmendChange: (value: boolean) => void;
  onOptionsExpandedChange: (value: boolean) => void;
  onOptionsChange: (options: CommitOptions) => void;
  onCommit: () => void;
};

export function CommitForm({
  summary,
  description,
  amendPreviousCommit,
  commitOptions,
  optionsExpanded,
  canCommit,
  blockingReason,
  pushedWarning,
  loading,
  onSummaryChange,
  onDescriptionChange,
  onAmendChange,
  onOptionsExpandedChange,
  onOptionsChange,
  onCommit,
}: CommitFormProps) {
  return (
    <section className="border-t border-white/[0.08] bg-[#0c111a]/95 p-3">
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase text-slate-400">
            Commit summary
            <span className={cn("font-mono text-[10px]", summary.length > 72 ? "text-amber-300" : "text-slate-500")}>
              {summary.length}/72
            </span>
          </span>
          <input
            value={summary}
            onChange={(event) => onSummaryChange(event.target.value)}
            className="h-9 w-full rounded-md border border-white/10 bg-[#070a0f] px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/45 focus:ring-2 focus:ring-cyan-300/10"
            placeholder="Commit summary"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase text-slate-400">Description</span>
          <textarea
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            className="min-h-20 w-full resize-none rounded-md border border-white/10 bg-[#070a0f] px-3 py-2 text-sm leading-5 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/45 focus:ring-2 focus:ring-cyan-300/10"
            placeholder="Optional description"
          />
        </label>

        <label className="flex items-start gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={amendPreviousCommit}
            onChange={(event) => onAmendChange(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-white/20 bg-[#070a0f] accent-cyan-400"
          />
          <span className="min-w-0">
            <span className="block font-medium text-slate-200">Amend previous commit</span>
            {pushedWarning && amendPreviousCommit ? (
              <span className="mt-1 block text-xs leading-5 text-amber-200">
                Previous commit appears on the upstream branch. Amending rewrites published history.
              </span>
            ) : null}
          </span>
        </label>

        <section className="rounded-md border border-white/[0.08] bg-white/[0.025]">
          <button
            type="button"
            onClick={() => onOptionsExpandedChange(!optionsExpanded)}
            className="flex h-9 w-full items-center gap-2 px-3 text-left text-[11px] font-semibold uppercase text-slate-400"
          >
            <ChevronDown size={14} className={cn("transition", !optionsExpanded && "-rotate-90")} />
            Commit options
          </button>
          {optionsExpanded ? (
            <div className="space-y-2 border-t border-white/[0.06] p-3">
              <OptionCheckbox
                label="Sign-off commit"
                checked={commitOptions.signOff}
                onChange={(checked) => onOptionsChange({ ...commitOptions, signOff: checked })}
              />
              <OptionCheckbox
                label="Allow empty commit"
                checked={commitOptions.allowEmpty}
                onChange={(checked) => onOptionsChange({ ...commitOptions, allowEmpty: checked })}
              />
              <OptionCheckbox
                label="No verify"
                checked={commitOptions.noVerify}
                onChange={(checked) => onOptionsChange({ ...commitOptions, noVerify: checked })}
              />
              <label className="block">
                <span className="mb-1 block text-[11px] text-slate-500">Author override</span>
                <input
                  value={commitOptions.author ?? ""}
                  onChange={(event) => onOptionsChange({ ...commitOptions, author: event.target.value })}
                  className="h-8 w-full rounded border border-white/10 bg-[#070a0f] px-2 text-xs text-slate-100 outline-none focus:border-cyan-300/40"
                  placeholder="Name <email@example.com>"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-slate-500">Commit date override</span>
                <input
                  type="datetime-local"
                  value={commitOptions.date ?? ""}
                  onChange={(event) => onOptionsChange({ ...commitOptions, date: event.target.value })}
                  className="h-8 w-full rounded border border-white/10 bg-[#070a0f] px-2 text-xs text-slate-100 outline-none focus:border-cyan-300/40"
                />
              </label>
            </div>
          ) : null}
        </section>

        {blockingReason ? (
          <p className="rounded-md border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs leading-5 text-rose-100">
            {blockingReason}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!canCommit || loading}
          onClick={onCommit}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-cyan-500 px-3 text-sm font-semibold text-white transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
        >
          <GitCommitHorizontal size={16} />
          {amendPreviousCommit ? "Amend commit" : "Commit"}
        </button>
      </div>
    </section>
  );
}

function OptionCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-white/20 bg-[#070a0f] accent-cyan-400"
      />
      {label}
    </label>
  );
}
