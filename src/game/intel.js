// src/systems/intel.js
import { state } from "../core/state.js";
import { roachEvent } from "./roach.js";

// Canonical keys used in HUD (5 to gate finale)
export const INTEL_KEYS = ["CATALYST", "STABILIZER", "DARTS", "UPLINK", "FORMULA"];

export function initIntel() {
  if (!state.intel) state.intel = { found: {}, count: 0 };
}

export function grantIntel(key) {
  if (!key) return false;
  initIntel();
  if (state.intel.found[key]) return false;   // already have it
  state.intel.found[key] = true;
  state.intel.count = Object.keys(state.intel.found).length;
  roachEvent?.("INTEL_GAINED", { count: state.intel.count, total: 5 });
  return true;
}

export function hasAllIntel() {
  return !!(state.intel && state.intel.count >= 5);
}
