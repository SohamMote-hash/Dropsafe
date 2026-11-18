import { describe, expect, it } from 'vitest';
import { DEVICE_LINK_LABEL, deviceLinkStatus, isTelemetryFresh, staleWindowMs } from './cloud';
import type { CloudStatus } from '../types';

const cloud = (overrides: Partial<CloudStatus> = {}): CloudStatus => ({
  configured: true,
  subscribed: true,
  connected: true,
  deviceSeen: true,
  lastSeen: 1_000_000,
  publishIntervalSec: 5,
  firmware: '1.0.0',
  rssi: -60,
  error: null,
  ...overrides,
});

const NOW = 1_000_000;

describe('deviceLinkStatus', () => {
  it('reports SIMULATED regardless of cloud state', () => {
    expect(deviceLinkStatus('SIMULATED', cloud({ connected: false }), NOW, 30)).toBe('SIMULATED');
  });

  it('reports USB for hardware mode', () => {
    expect(deviceLinkStatus('HARDWARE', cloud(), NOW, 30)).toBe('USB');
  });

  it('is OFFLINE before listeners are attached', () => {
    expect(deviceLinkStatus('FIREBASE', cloud({ subscribed: false }), NOW, 30)).toBe('OFFLINE');
  });

  it('is OFFLINE when the Firebase socket is disconnected', () => {
    expect(deviceLinkStatus('FIREBASE', cloud({ connected: false }), NOW, 30)).toBe('OFFLINE');
  });

  it('is WAITING until the device heartbeat is received', () => {
    expect(deviceLinkStatus('FIREBASE', cloud({ deviceSeen: false }), NOW, 30)).toBe('WAITING');
  });

  it('is WAITING when the device has no lastSeen timestamp', () => {
    expect(deviceLinkStatus('FIREBASE', cloud({ lastSeen: null }), NOW, 30)).toBe('WAITING');
  });

  it('is ONLINE for a fresh heartbeat', () => {
    expect(deviceLinkStatus('FIREBASE', cloud({ lastSeen: NOW - 5_000 }), NOW, 30)).toBe('ONLINE');
  });

  it('is STALE once the heartbeat exceeds the stale window', () => {
    expect(deviceLinkStatus('FIREBASE', cloud({ lastSeen: NOW - 31_000 }), NOW, 30)).toBe('STALE');
  });

  it('extends the stale window to three publish intervals', () => {
    // 20 s stale threshold, 10 s interval -> 30 s window, so 25 s is still fresh.
    expect(deviceLinkStatus('FIREBASE', cloud({ lastSeen: NOW - 25_000, publishIntervalSec: 10 }), NOW, 20))
      .toBe('ONLINE');
    expect(deviceLinkStatus('FIREBASE', cloud({ lastSeen: NOW - 31_000, publishIntervalSec: 10 }), NOW, 20))
      .toBe('STALE');
  });

  it('treats exactly the stale boundary as fresh', () => {
    expect(deviceLinkStatus('FIREBASE', cloud({ lastSeen: NOW - 30_000 }), NOW, 30)).toBe('ONLINE');
  });

  it('exposes a label for every status', () => {
    expect(DEVICE_LINK_LABEL.ONLINE).toBe('ONLINE');
    expect(DEVICE_LINK_LABEL.WAITING).toBe('WAITING');
    expect(DEVICE_LINK_LABEL.OFFLINE).toBe('OFFLINE');
    expect(DEVICE_LINK_LABEL.STALE).toBe('STALE');
    expect(DEVICE_LINK_LABEL.SIMULATED).toBe('SIMULATED');
    expect(DEVICE_LINK_LABEL.USB).toBe('USB LIVE');
  });
});

describe('staleWindowMs', () => {
  it('uses the larger of the configured threshold and three publish intervals', () => {
    expect(staleWindowMs(5, 30)).toBe(30_000);
    expect(staleWindowMs(10, 20)).toBe(30_000);
  });
});

describe('isTelemetryFresh', () => {
  it('accepts readings up to the stale boundary', () => {
    expect(isTelemetryFresh(NOW - 5_000, NOW, 5, 30)).toBe(true);
    expect(isTelemetryFresh(NOW - 30_000, NOW, 5, 30)).toBe(true);
  });

  it('rejects readings past the stale boundary', () => {
    expect(isTelemetryFresh(NOW - 30_001, NOW, 5, 30)).toBe(false);
  });

  it('extends the window to three publish intervals', () => {
    expect(isTelemetryFresh(NOW - 25_000, NOW, 10, 20)).toBe(true);
    expect(isTelemetryFresh(NOW - 31_000, NOW, 10, 20)).toBe(false);
  });

  it('treats a missing timestamp as stale', () => {
    expect(isTelemetryFresh(null, NOW, 5, 30)).toBe(false);
  });
});
