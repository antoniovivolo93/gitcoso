import { FormEvent, useState } from "react";
import { Check, X } from "lucide-react";
import { useRepositoryStore } from "../../store/repositoryStore";
import { Button } from "../ui/Button";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CommitDialog({ open, onClose }: Props) {
  const [message, setMessage] = useState("");
  const { commit, loading } = useRepositoryStore();

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    await commit(message.trim());
    setMessage("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-[460px] rounded-lg border border-white/10 bg-surface-850 p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Check size={16} className="text-accent-green" />
            Commit staged changes
          </h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <label className="mb-2 block text-xs font-semibold uppercase text-slate-500" htmlFor="commit-message">
          Commit message
        </label>
        <textarea
          id="commit-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          autoFocus
          rows={5}
          placeholder="Describe the staged changes"
          className="mb-5 w-full resize-none rounded-md border border-white/10 bg-black/24 px-3 py-2 text-sm leading-6 outline-none transition placeholder:text-slate-600 focus:border-accent-violet/60"
        />
        <div className="rounded-md border border-white/10 bg-white/[0.035] p-3 text-xs leading-5 text-slate-400">
          This action creates a commit from the files currently staged in Git.
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={loading || !message.trim()}>Commit</Button>
        </div>
      </form>
    </div>
  );
}
