import type { CloudStatus, DeviceLinkStatus, MonitorSource } from '../types';

/** Grace window for a heartbeat or reading, extended to three publish intervals. */
export function staleWindowMs(publishIntervalSec: number, staleAfterSec: number): number {
  return Math.max(staleAfterSec, publishIntervalSec * 3) * 1000;
}

/** True when a server-stamped record is recent enough to be trusted as live. */
export function isTelemetryFresh(
  timestamp: number | null,
  now: number,
  publishIntervalSec: number,
  staleAfterSec: number,
): boolean {
  return timestamp !== null
    && Number.isFinite(timestamp)
    && now - timestamp <= staleWindowMs(publishIntervalSec, staleAfterSec);
}

/**
 * Connectivity status shown in the dashboard. An ESP32 that stops publishing leaves its
 * last RTDB record in place, so staleness is inferred from the last server timestamp.
 */
export function deviceLinkStatus(
  source: MonitorSource,
  cloud: CloudStatus,
  now: number,
  staleAfterSec: number,
): DeviceLinkStatus {
  if (source === 'SIMULATED') return 'SIMULATED';
  if (source === 'HARDWARE') return 'USB';
  if (!cloud.subscribed || !cloud.connected) return 'OFFLINE';
  if (!cloud.deviceSeen || cloud.lastSeen === null) return 'WAITING';
  return now - cloud.lastSeen > staleWindowMs(cloud.publishIntervalSec, staleAfterSec) ? 'STALE' : 'ONLINE';
}

export const DEVICE_LINK_LABEL: Record<DeviceLinkStatus, string> = {
  SIMULATED: 'SIMULATED',
  USB: 'USB LIVE',
  WAITING: 'WAITING',
  ONLINE: 'ONLINE',
  STALE: 'STALE',
  OFFLINE: 'OFFLINE',
};
