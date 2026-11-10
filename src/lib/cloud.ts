import type { CloudStatus, DeviceLinkStatus, MonitorSource } from '../types';

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
  const staleAfter = Math.max(staleAfterSec, cloud.publishIntervalSec * 3);
  return now - cloud.lastSeen > staleAfter * 1000 ? 'STALE' : 'ONLINE';
}

export const DEVICE_LINK_LABEL: Record<DeviceLinkStatus, string> = {
  SIMULATED: 'SIMULATED',
  USB: 'USB LIVE',
  WAITING: 'WAITING',
  ONLINE: 'ONLINE',
  STALE: 'STALE',
  OFFLINE: 'OFFLINE',
};
