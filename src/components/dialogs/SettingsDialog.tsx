import { FormEvent, useEffect, useState } from "react";
import { Settings, X } from "lucide-react";
import { supportedLanguages } from "../../i18n";
import { useRepositoryStore } from "../../store/repositoryStore";
import { type AppSettings, useSettingsStore } from "../../store/settingsStore";
import { Button } from "../ui/Button";

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, setSettings, t } = useSettingsStore();
  const notify = useRepositoryStore((state) => state.notify);
  const [draft, setDraft] = useState<AppSettings>(settings);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  if (!open) return null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSettings(draft);
    notify("success", t("settings.saved"));
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-[520px] rounded-lg border border-white/10 bg-surface-850 p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Settings size={16} className="text-accent-blue" />
            {t("settings.title")}
          </h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <section className="mb-5">
          <h3 className="mb-3 text-xs font-semibold uppercase text-slate-500">{t("settings.profile")}</h3>
          <div className="grid gap-3">
            <TextField
              label={t("settings.displayName")}
              value={draft.profile.displayName}
              onChange={(displayName) => setDraft({ ...draft, profile: { ...draft.profile, displayName } })}
            />
            <TextField
              label={t("settings.email")}
              value={draft.profile.email}
              onChange={(email) => setDraft({ ...draft, profile: { ...draft.profile, email } })}
            />
            <TextField
              label={t("settings.avatarUrl")}
              value={draft.profile.avatarUrl}
              onChange={(avatarUrl) => setDraft({ ...draft, profile: { ...draft.profile, avatarUrl } })}
            />
          </div>
        </section>

        <section className="mb-5">
          <h3 className="mb-3 text-xs font-semibold uppercase text-slate-500">{t("settings.preferences")}</h3>
          <div className="grid gap-3">
            <label className="grid gap-1.5 text-xs font-semibold uppercase text-slate-500">
              {t("settings.language")}
              <select
                value={draft.language}
                onChange={(event) => setDraft({ ...draft, language: event.target.value })}
                className="h-10 rounded-md border border-white/10 bg-black/24 px-3 text-sm normal-case text-slate-100 outline-none focus:border-accent-violet/60"
              >
                {supportedLanguages.map((language) => (
                  <option key={language.code} value={language.code}>
                    {t(language.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label={t("settings.defaultBaseBranch")}
              value={draft.defaultBaseBranch}
              onChange={(defaultBaseBranch) => setDraft({ ...draft, defaultBaseBranch })}
            />
            <ToggleField
              label={t("settings.confirmDestructive")}
              checked={draft.confirmDestructiveActions}
              onChange={(confirmDestructiveActions) => setDraft({ ...draft, confirmDestructiveActions })}
            />
            <ToggleField
              label={t("settings.openTerminalByDefault")}
              checked={draft.openTerminalByDefault}
              onChange={(openTerminalByDefault) => setDraft({ ...draft, openTerminalByDefault })}
            />
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">{t("settings.languageHelp")}</p>
        </section>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>{t("actions.close")}</Button>
          <Button type="submit" variant="primary">{t("actions.save")}</Button>
        </div>
      </form>
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold uppercase text-slate-500">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-white/10 bg-black/24 px-3 text-sm normal-case text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-accent-violet/60"
      />
    </label>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-violet-500"
      />
      {label}
    </label>
  );
}
