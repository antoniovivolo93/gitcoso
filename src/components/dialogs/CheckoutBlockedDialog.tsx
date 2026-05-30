import { AlertTriangle, Archive, X } from "lucide-react";
import { useRepositoryStore } from "../../store/repositoryStore";
import { Button } from "../ui/Button";

export function CheckoutBlockedDialog() {
  const { checkoutBlocked, loading, clearCheckoutBlocked, stashAndCheckout } = useRepositoryStore();

  if (!checkoutBlocked) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 backdrop-blur-sm">
      <div className="w-[520px] rounded-lg border border-white/10 bg-surface-850 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle size={16} className="text-amber-300" />
            Checkout blocked
          </h2>
          <button
            type="button"
            onClick={clearCheckoutBlocked}
            className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <p className="mb-4 text-sm leading-6 text-slate-300">
          Git cannot switch to <span className="font-mono text-slate-100">{checkoutBlocked.branch}</span> because local
          changes would be overwritten.
        </p>

        {checkoutBlocked.files.length > 0 ? (
          <div className="mb-4 max-h-40 overflow-auto rounded-md border border-white/10 bg-black/20 p-3">
            {checkoutBlocked.files.map((file) => (
              <div key={file} className="truncate font-mono text-xs leading-6 text-slate-400" title={file}>
                {file}
              </div>
            ))}
          </div>
        ) : null}

        <div className="mb-5 rounded-md border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">
          Stashing saves your current local changes in Git stash, then switches branch. You can re-apply the stash later
          from the command line.
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={clearCheckoutBlocked}>
            Cancel
          </Button>
          <Button type="button" variant="primary" icon={Archive} disabled={loading} onClick={stashAndCheckout}>
            Stash and checkout
          </Button>
        </div>
      </div>
    </div>
  );
}
