import type { BagStatus, AlertType, Settings } from '../types';
import { isFiniteNumber } from './calculations';

/**
 * Threshold logic. CRITICAL is checked before LOW so it always wins.
 * A missing / invalid volume means the sensor is faulty.
 * These thresholds are classroom demonstration values, not clinical recommendations.
 */
export function classifyStatus(
  volumeMl: number | null,
  thresholds: Pick<Settings, 'lowMl' | 'criticalMl'>,
): BagStatus {
  if (!isFiniteNumber(volumeMl)) return 'SENSOR_FAULT';
  if (volumeMl <= thresholds.criticalMl) return 'CRITICAL';
  if (volumeMl <= thresholds.lowMl) return 'LOW';
  return 'NORMAL';
}

export const alertTypeFor = (status: BagStatus): AlertType | null =>
  status === 'NORMAL' ? null : status;

/** Higher = more urgent. Used to choose which alarm sound plays. */
export const SEVERITY: Record<AlertType, number> = { LOW: 1, SENSOR_FAULT: 2, CRITICAL: 3 };

export const STATUS_META: Record<
  BagStatus,
  { label: string; hex: string; badge: string; banner: string; dot: string }
> = {
  NORMAL: {
    label: 'NORMAL',
    hex: '#16a34a',
    badge: 'bg-green-100 text-green-800 ring-green-600/25',
    banner: 'border-green-300 bg-green-50 text-green-900',
    dot: 'bg-green-500',
  },
  LOW: {
    label: 'LOW',
    hex: '#d97706',
    badge: 'bg-amber-100 text-amber-900 ring-amber-600/30',
    banner: 'border-amber-300 bg-amber-50 text-amber-900',
    dot: 'bg-amber-500',
  },
  CRITICAL: {
    label: 'CRITICAL',
    hex: '#dc2626',
    badge: 'bg-red-100 text-red-800 ring-red-600/30',
    banner: 'border-red-300 bg-red-50 text-red-900',
    dot: 'bg-red-500',
  },
  SENSOR_FAULT: {
    label: 'SENSOR FAULT',
    hex: '#7c3aed',
    badge: 'bg-violet-100 text-violet-800 ring-violet-600/30',
    banner: 'border-violet-300 bg-violet-50 text-violet-900',
    dot: 'bg-violet-500',
  },
};

export const ALERT_LABEL: Record<AlertType, string> = {
  LOW: 'Low fluid',
  CRITICAL: 'Critical fluid',
  SENSOR_FAULT: 'Sensor fault',
};
