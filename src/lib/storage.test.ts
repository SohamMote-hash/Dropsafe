import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AlertEvent } from '../types';
import { loadAlerts, loadBagConfigs, saveAlerts, saveBagConfigs } from './storage';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

const alert: AlertEvent = {
  id: 'a1', timestamp: 1_700_000_000_000, bagId: 'IV-01', type: 'LOW',
  volumeMl: 90, acknowledged: false, acknowledgedAt: null, simulated: true,
};

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('alert storage', () => {
  it('discards and removes legacy v1 history', () => {
    localStorage.setItem('dropsafe.alerts.v1', JSON.stringify([alert]));

    expect(loadAlerts()).toEqual([]);
    expect(localStorage.getItem('dropsafe.alerts.v1')).toBeNull();
  });

  it('round-trips alerts written to the current key', () => {
    saveAlerts([alert]);

    expect(JSON.parse(localStorage.getItem('dropsafe.alerts.v2') ?? '[]')).toHaveLength(1);
    expect(loadAlerts()).toEqual([alert]);
  });
});

describe('bag storage', () => {
  it('drops the built-in live bag and invalid entries', () => {
    localStorage.setItem('dropsafe.bags.v1', JSON.stringify([
      { id: 'IV-01', name: 'Live', initialVolumeMl: 500, startVolumeMl: 500, flowMlH: 120 },
      { id: 'IV-02', name: 'Ward A', initialVolumeMl: 250, startVolumeMl: 250, flowMlH: 60 },
      { id: 'bad', name: '', initialVolumeMl: 0, startVolumeMl: 0, flowMlH: 60 },
      'nonsense',
    ]));

    expect(loadBagConfigs()).toEqual([
      { id: 'IV-02', name: 'Ward A', initialVolumeMl: 250, startVolumeMl: 250, flowMlH: 60 },
    ]);
  });

  it('returns an empty list for missing or corrupt data', () => {
    expect(loadBagConfigs()).toEqual([]);
    localStorage.setItem('dropsafe.bags.v1', '{not json');
    expect(loadBagConfigs()).toEqual([]);
  });

  it('persists only added bags', () => {
    saveBagConfigs([
      { id: 'IV-01', name: 'Live', initialVolumeMl: 500, startVolumeMl: 420, flowMlH: 120 },
      { id: 'IV-02', name: 'Ward A', initialVolumeMl: 250, startVolumeMl: 250, flowMlH: 60 },
    ]);

    expect(loadBagConfigs().map((config) => config.id)).toEqual(['IV-02']);
  });
});
