/// <reference types="vite/client" />

import type { BranchFlowApi } from "./shared/types";

declare global {
  interface Window {
    branchFlow: BranchFlowApi;
  }
}
