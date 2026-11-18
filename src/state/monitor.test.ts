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

describe('SET_SOURCE', () => {
  it('drops the demo history of the live channel when a live source is selected', () => {
    const simulated = createInitialState(DEFAULT_SETTINGS, [], NOW);
    expect(simulated.bags[0].history.length).toBeGreaterThan(0);

    const live = monitorReducer(simulated, {
      type: 'SET_SOURCE', source: 'FIREBASE', liveBagId: 'IV-01',
    });

    expect(live.bags[0].history).toHaveLength(0);
    expect(live.bags[0].flowMlH).toBeNull();
  });

  it('keeps the cloud record time as the last reading after history hydration', () => {
    const recordedAt = NOW - 120_000;
    let state = createInitialState(DEFAULT_SETTINGS, [], NOW);
    state = monitorReducer(state, { type: 'SET_SOURCE', source: 'FIREBASE', liveBagId: 'IV-01' });
    state = monitorReducer(state, {
      type: 'SENSOR_READING',
      reading: { bagId: 'IV-01', timestamp: recordedAt, simSeconds: recordedAt / 1000, weightG: 530.63 },
    });
    state = monitorReducer(state, {
      type: 'HYDRATE_HISTORY',
      bagId: 'IV-01',
      points: [{ t: recordedAt, simS: recordedAt / 1000, volumeMl: 432.9, weightG: 530.6, flowMlH: null }],
    });

    expect(state.bags[0].lastReadingAt).toBe(recordedAt);
    expect(state.bags[0].history.some((point) => point.t === NOW)).toBe(false);
  });

  it('drops the live history when falling back to the demo', () => {
    let state = createInitialState(DEFAULT_SETTINGS, [], NOW);
    state = monitorReducer(state, { type: 'SET_SOURCE', source: 'FIREBASE', liveBagId: 'IV-01' });
    state = monitorReducer(state, {
      type: 'SENSOR_READING',
      reading: { bagId: 'IV-01', timestamp: NOW, simSeconds: NOW / 1000, weightG: 530.63 },
    });
    expect(state.bags[0].history).toHaveLength(1);

    state = monitorReducer(state, { type: 'SET_SOURCE', source: 'SIMULATED' });

    expect(state.source).toBe('SIMULATED');
    expect(state.bags[0].history).toHaveLength(0);
    expect(state.bags[0].flowMlH).toBeNull();
  });

  it('resumes the demo clock after a fallback', () => {
    let state = createInitialState(DEFAULT_SETTINGS, [], NOW);
    state = monitorReducer(state, { type: 'SET_SOURCE', source: 'FIREBASE', liveBagId: 'IV-01' });
    state = monitorReducer(state, { type: 'SET_SOURCE', source: 'SIMULATED' });
    const before = state.bags[0].volumeMl;

    state = monitorReducer(state, { type: 'TICK', now: NOW + DEFAULT_SETTINGS.intervalSec * 1000 });

    expect(state.bags[0].volumeMl).toBeLessThan(before);
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
