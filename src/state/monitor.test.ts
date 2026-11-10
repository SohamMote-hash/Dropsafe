import { describe, expect, it } from 'vitest';
import type { BagConfig } from '../data/sensorProvider';
import { DEFAULT_SETTINGS } from '../lib/settings';
import { createInitialState, monitorReducer, type MonitorState } from './monitor';

const NOW = 1_700_000_000_000;

const extraBag = (overrides: Partial<BagConfig> = {}): BagConfig => ({
  id: 'IV-02',
  name: 'Ward A',
  initialVolumeMl: 1000,
  startVolumeMl: 1000,
  flowMlH: 80,
  ...overrides,
});

const withAddedBag = (state: MonitorState, overrides: Partial<BagConfig> = {}) => {
  const config = extraBag(overrides);
  return monitorReducer(state, {
    type: 'ADD_BAG',
    name: config.name,
    initialVolumeMl: config.initialVolumeMl,
    startVolumeMl: config.startVolumeMl,
    flowMlH: config.flowMlH,
    now: NOW,
  });
};

describe('initial monitor state', () => {
  it('starts with the single live bag', () => {
    const state = createInitialState(DEFAULT_SETTINGS, [], NOW);

    expect(state.bags.map((bag) => bag.id)).toEqual(['IV-01']);
    expect(state.bagConfigs.map((config) => config.id)).toEqual(['IV-01']);
    expect(state.selectedBagId).toBe('IV-01');
  });

  it('restores persisted extra bags alongside the live bag', () => {
    const state = createInitialState(DEFAULT_SETTINGS, [], NOW, [extraBag({ id: 'IV-07', name: 'Persisted' })]);

    expect(state.bags.map((bag) => bag.id)).toEqual(['IV-01', 'IV-07']);
    expect(state.bagConfigs.map((config) => config.id)).toEqual(['IV-01', 'IV-07']);
    expect(state.bags[1].name).toBe('Persisted');
  });
});

describe('ADD_BAG', () => {
  it('adds the next free channel as a running simulated bag', () => {
    const state = withAddedBag(createInitialState(DEFAULT_SETTINGS, [], NOW));

    expect(state.bags.map((bag) => bag.id)).toEqual(['IV-01', 'IV-02']);
    expect(state.bags[1].name).toBe('Ward A');
    expect(state.bags[1].initialVolumeMl).toBe(1000);
    expect(state.bags[1].volumeMl).toBeCloseTo(1000, 0);
    expect(state.bags[1].status).toBe('NORMAL');
    expect(state.sims['IV-02']).toBeDefined();
    expect(state.selectedBagId).toBe('IV-01');
  });

  it('skips channel numbers that are already taken', () => {
    const withPersisted = createInitialState(DEFAULT_SETTINGS, [], NOW, [extraBag({ id: 'IV-02' })]);
    const state = withAddedBag(withPersisted);

    expect(state.bags.map((bag) => bag.id)).toEqual(['IV-01', 'IV-02', 'IV-03']);
  });

  it('starts added bags as sensor faults while a live source is active', () => {
    const live = monitorReducer(createInitialState(DEFAULT_SETTINGS, [], NOW), {
      type: 'SET_SOURCE', source: 'FIREBASE', liveBagId: 'IV-01',
    });
    const state = withAddedBag(live);

    expect(state.bags[1].status).toBe('SENSOR_FAULT');
    expect(state.bags[1].history).toHaveLength(0);
  });

  it('resets an added bag to its own configured volume', () => {
    let state = withAddedBag(createInitialState(DEFAULT_SETTINGS, [], NOW));
    state = monitorReducer(state, { type: 'MANUAL_REDUCE', bagId: 'IV-02', amountMl: 600, now: NOW + 1000 });
    state = monitorReducer(state, { type: 'RESET_BAG', bagId: 'IV-02', now: NOW + 2000 });

    expect(state.bags[1].volumeMl).toBeCloseTo(1000, 0);
  });
});
