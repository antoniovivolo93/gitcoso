/// <reference types="vite/client" />

import type { GitCosoApi } from "./shared/types";

declare global {
  interface Window {
    gitCoso: GitCosoApi;
  }
}
