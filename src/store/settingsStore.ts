import { create } from "zustand";
import { resolveInitialLanguage, translate, type LanguageCode } from "../i18n";

const settingsStorageKey = "gitcoso.settings";

export type AppSettings = {
  language: LanguageCode;
  profile: {
    displayName: string;
    email: string;
    avatarUrl: string;
  };
  defaultBaseBranch: string;
  confirmDestructiveActions: boolean;
  openTerminalByDefault: boolean;
};

type SettingsState = {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
};

const defaultSettings: AppSettings = {
  language: resolveInitialLanguage(),
  profile: {
    displayName: "",
    email: "",
    avatarUrl: "",
  },
  defaultBaseBranch: "main",
  confirmDestructiveActions: true,
  openTerminalByDefault: true,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: readSettings(),

  setSettings: (settings) => {
    writeSettings(settings);
    set({ settings });
  },

  updateSettings: (partial) => {
    const settings = { ...get().settings, ...partial };
    writeSettings(settings);
    set({ settings });
  },

  t: (key, values) => translate(get().settings.language, key, values),
}));

function readSettings(): AppSettings {
  try {
    const value = window.localStorage.getItem(settingsStorageKey);
    if (!value) return defaultSettings;
    const parsed = JSON.parse(value) as Partial<AppSettings>;
    return {
      ...defaultSettings,
      ...parsed,
      profile: {
        ...defaultSettings.profile,
        ...(parsed.profile ?? {}),
      },
    };
  } catch {
    return defaultSettings;
  }
}

function writeSettings(settings: AppSettings) {
  window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
}
