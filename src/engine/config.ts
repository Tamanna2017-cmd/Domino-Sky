import type { SimSettings } from './types';

/** Default operating assumptions. Surfaced to the judges in the Settings panel. */
export const DEFAULT_SETTINGS: SimSettings = {
  minTurnaround: 40,
  minConnect: 45,
  cancelDelayThreshold: 240,
  onTimeThreshold: 15,
  delayCostPerMin: 520,
  delayCostPerPaxMin: 2.2,
  cancellationCost: 850_000,
  diversionCost: 480_000,
  misconnectCost: 4_500,
  strandingCost: 7_500,
  rebookCost: 3_000,
};

/** Fixed cost of each recovery lever (₹). */
export const ACTION_COSTS = {
  swap: 22_000,
  cancel: 0,
  hold: 9_000,
  spare: 140_000,
  retime: 7_500,
  rebook: 0,
} as const;

export const DAY_START = 4 * 60;
export const DAY_END = 24 * 60;
