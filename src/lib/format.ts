import { isFiniteNumber } from './calculations';

export const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const formatDateTime = (ts: number) =>
  new Date(ts).toLocaleString([], {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });

export const formatMl = (v: number | null | undefined) =>
  isFiniteNumber(v) ? `${v.toFixed(0)} mL` : '—';

export const formatGrams = (v: number | null | undefined) =>
  isFiniteNumber(v) ? `${v.toFixed(1)} g` : '—';

export const formatFlow = (v: number | null | undefined) =>
  isFiniteNumber(v) ? `${v.toFixed(0)} mL/h` : 'Unavailable';

/** Allow two missed polling windows before marking a live reading stale. */
export function readingFreshness(ageSec: number, intervalSec: number, active: boolean): 'paused' | 'fresh' | 'stale' {
  if (!active) return 'paused';
  return ageSec > intervalSec * 2 ? 'stale' : 'fresh';
}

/** Hours -> "2 h 05 min", "45 min", "Empty" or "Unavailable". */
export function formatDuration(hours: number | null): string {
  if (!isFiniteNumber(hours) || hours < 0) return 'Unavailable';
  if (hours === 0) return 'Empty';
  const totalMin = Math.round(hours * 60);
  if (totalMin < 1) return '< 1 min';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h === 0 ? `${m} min` : `${h} h ${String(m).padStart(2, '0')} min`;
}
