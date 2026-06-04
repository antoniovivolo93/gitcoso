import { FormEvent, useState } from "react";
import { GitBranch, X } from "lucide-react";
import { useRepositoryStore } from "../../store/repositoryStore";
import { useSettingsStore } from "../../store/settingsStore";
import { Button } from "../ui/Button";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CreateBranchDialog({ open, onClose }: Props) {
  const [name, setName] = useState("");
  const [checkout, setCheckout] = useState(true);
  const { createBranch, loading } = useRepositoryStore();
  const t = useSettingsStore().t;

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    await createBranch(name.trim(), checkout);
    setName("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-[420px] rounded-lg border border-white/10 bg-surface-850 p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <GitBranch size={16} className="text-accent-blue" />
            {t("dialog.createBranch")}
          </h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <label className="mb-2 block text-xs font-semibold uppercase text-slate-500" htmlFor="branch-name">
          {t("dialog.branchName")}
        </label>
        <input
          id="branch-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          placeholder="feature/new-flow"
          className="mb-4 h-10 w-full rounded-md border border-white/10 bg-black/24 px-3 text-sm outline-none transition placeholder:text-slate-600 focus:border-accent-violet/60"
        />
        <label className="mb-5 flex items-center gap-3 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={checkout}
            onChange={(event) => setCheckout(event.target.checked)}
            className="h-4 w-4 accent-violet-500"
          />
          {t("dialog.checkoutImmediately")}
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>{t("dialog.cancel")}</Button>
          <Button type="submit" variant="primary" disabled={loading || !name.trim()}>{t("dialog.create")}</Button>
        </div>
      </form>
    </div>
  );
}
