// Pure calculation helpers. No React, no browser APIs.
import type { DataPoint } from '../types';

/** 0.9 % saline is ~1.005 g/mL. Configurable for other fluids. */
export const FLUID_DENSITY_G_PER_ML = 1.005;
/** Zero offset of this rig's hanging assembly; fitted together with the firmware factor. */
export const EMPTY_BAG_TARE_G = 95.6;
/** Upper limit of the 5 kg load cell; larger values are treated as invalid. */
export const MAX_LOAD_G = 5000;
/** Flow rates above this are treated as invalid measurements. */
export const MAX_FLOW_ML_H = 2000;
/** Number of recent samples used to estimate flow (smooths sensor noise). */
export const FLOW_WINDOW = 6;

export const isFiniteNumber = (x: unknown): x is number =>
  typeof x === 'number' && Number.isFinite(x);

export const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
export const roundTo = (x: number, digits = 1) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

/** remaining % = remaining volume / initial volume x 100, clamped to 0..100. */
export function remainingPercent(volumeMl: number, initialMl: number): number {
  if (!isFiniteNumber(volumeMl) || !isFiniteNumber(initialMl) || initialMl <= 0) return 0;
  return clamp((volumeMl / initialMl) * 100, 0, 100);
}

/** remaining volume ~ (measured weight - empty-bag tare) / fluid density. Never negative. */
export function volumeFromWeight(
  weightG: number,
  tareG = EMPTY_BAG_TARE_G,
  densityGPerMl = FLUID_DENSITY_G_PER_ML,
): number | null {
  if (!isFiniteNumber(weightG) || !isFiniteNumber(tareG) || !isFiniteNumber(densityGPerMl)) return null;
  if (densityGPerMl <= 0) return null;
  return Math.max(0, (weightG - tareG) / densityGPerMl);
}

/** Inverse of volumeFromWeight; used only by the demo sensor to fake a load-cell weight. */
export function weightFromVolume(
  volumeMl: number,
  tareG = EMPTY_BAG_TARE_G,
  densityGPerMl = FLUID_DENSITY_G_PER_ML,
): number {
  return volumeMl * densityGPerMl + tareG;
}

/**
 * Flow rate in mL/hour from two volumes taken `elapsedSeconds` apart.
 * Returns null for invalid input, zero/negative time, a rising level, or absurd values.
 */
export function flowRateMlPerHour(
  earlierMl: number,
  laterMl: number,
  elapsedSeconds: number,
): number | null {
  if (!isFiniteNumber(earlierMl) || !isFiniteNumber(laterMl) || !isFiniteNumber(elapsedSeconds)) return null;
  if (elapsedSeconds <= 0) return null;
  const rate = (earlierMl - laterMl) / (elapsedSeconds / 3600);
  if (!Number.isFinite(rate) || rate < 0 || rate > MAX_FLOW_ML_H) return null;
  return rate;
}

/**
 * Estimates flow from the newest points of a history (oldest -> newest).
 * Walks back until a "discontinuity" (manual level change) so jumps never look like flow.
 */
export function estimateFlow(points: DataPoint[]): number | null {
  const window: DataPoint[] = [];
  for (let i = points.length - 1; i >= 0 && window.length < FLOW_WINDOW; i--) {
    const p = points[i];
    if (p.volumeMl === null) continue; // skip faulty samples
    window.push(p);
    if (p.discontinuity) break;
  }
  if (window.length < 2) return null;
  const newest = window[0];
  const oldest = window[window.length - 1];
  return flowRateMlPerHour(oldest.volumeMl as number, newest.volumeMl as number, newest.simS - oldest.simS);
}

/** time to empty (hours) = remaining volume / flow rate. Null when it can't be trusted. */
export function timeToEmptyHours(volumeMl: number, flowMlH: number | null): number | null {
  if (!isFiniteNumber(volumeMl) || volumeMl < 0) return null;
  if (volumeMl === 0) return 0;
  if (!isFiniteNumber(flowMlH) || flowMlH <= 0) return null;
  const h = volumeMl / flowMlH;
  return Number.isFinite(h) ? h : null;
}
