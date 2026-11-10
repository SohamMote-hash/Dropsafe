// DATA PROCESSING + ALERT LOGIC LAYER (pure functions, no demo-specific code).
// Raw SensorReading in -> updated Bag (+ maybe a new AlertEvent) out.
import type { AlertEvent, Alarm, Bag, BagStatus, DataPoint, SensorReading, Settings } from '../types';
import {
  MAX_LOAD_G, estimateFlow, isFiniteNumber, roundTo, volumeFromWeight,
} from './calculations';
import { alertTypeFor, classifyStatus } from './status';

export const MAX_HISTORY_POINTS = 60;

export interface ProcessOptions {
  /** The level was changed by a test control: restart flow estimation from this point. */
  discontinuity?: boolean;
  /** Drop the chart history first (used by Reset). */
  resetHistory?: boolean;
  /** Marks alerts from an actual hardware reading as non-simulated. */
  simulated?: boolean;
}

const newId = (now: number, bagId: string, type: string) =>
  `${now}-${bagId}-${type}-${Math.random().toString(36).slice(2, 6)}`;

/**
 * Applies a status to a bag. An alert record is created ONLY when the status changes to a
 * non-normal state - not on every update - and a status change resets the acknowledgement.
 */
export function applyStatus(
  bag: Bag,
  status: BagStatus,
  volumeMl: number,
  now: number,
  simulated = true,
): { bag: Bag; alert: AlertEvent | null } {
  if (status === bag.status) return { bag, alert: null };
  const type = alertTypeFor(status);
  const alert: AlertEvent | null = type
    ? { id: newId(now, bag.id, type), timestamp: now, bagId: bag.id, type, volumeMl: roundTo(volumeMl, 1),
        acknowledged: false, acknowledgedAt: null, simulated }
    : null;
  return { bag: { ...bag, status, ackedStatus: null }, alert };
}

export function processReading(
  bag: Bag,
  reading: SensorReading,
  settings: Settings,
  opts: ProcessOptions = {},
): { bag: Bag; alert: AlertEvent | null } {
  const w = reading.weightG;
  const weightValid = isFiniteNumber(w) && w >= 0 && w <= MAX_LOAD_G;
  const estimated = weightValid ? volumeFromWeight(w) : null;
  const volume = estimated === null ? null : roundTo(estimated, 1);

  // A cloud snapshot can repeat the newest stored point; replace it instead of duplicating.
  const base = opts.resetHistory ? [] : bag.history.filter((p) => p.t !== reading.timestamp);
  const point: DataPoint = {
    t: reading.timestamp,
    simS: reading.simSeconds,
    volumeMl: volume,
    weightG: weightValid ? roundTo(w as number, 1) : null,
    flowMlH: null,
    discontinuity: opts.discontinuity || undefined,
  };
  const all = [...base, point];
  // A faulty reading has no trustworthy flow estimate.
  point.flowMlH = volume === null ? null : estimateFlow(all);
  const history = all.slice(-MAX_HISTORY_POINTS);

  const status = classifyStatus(volume, settings);
  const updated: Bag = {
    ...bag,
    volumeMl: volume ?? bag.volumeMl,
    weightG: point.weightG,
    flowMlH: point.flowMlH,
    lastReadingAt: reading.timestamp,
    history,
  };
  return applyStatus(updated, status, volume ?? bag.volumeMl, reading.timestamp, opts.simulated ?? true);
}

/** Re-checks a bag against new thresholds without a new reading (used when settings change). */
export function reclassify(bag: Bag, settings: Settings, now: number, simulated = true): { bag: Bag; alert: AlertEvent | null } {
  if (bag.status === 'SENSOR_FAULT') return { bag, alert: null };
  return applyStatus(bag, classifyStatus(bag.volumeMl, settings), bag.volumeMl, now, simulated);
}

/** Bags currently needing attention, with whether the user has acknowledged them. */
export function deriveAlarms(bags: Bag[]): Alarm[] {
  const alarms: Alarm[] = [];
  for (const b of bags) {
    const type = alertTypeFor(b.status);
    if (!type) continue;
    alarms.push({ bagId: b.id, type, volumeMl: b.volumeMl, acknowledged: b.ackedStatus === b.status });
  }
  return alarms;
}
