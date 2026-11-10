// Application state: a pure reducer. All demo controls and ticks go through here, so the
// UI never edits data directly and "pause" really stops every automatic change.
import type { AlertEvent, Bag, DataPoint, DemoSim, MonitorSource, SensorReading, Settings } from '../types';
import {
  LIVE_BAG_CONFIG, SIM_SPEED, createDemoSim, nextBagId, readDemoSensor, stepDemoSim,
  type BagConfig,
} from '../data/sensorProvider';
import { estimateFlow } from '../lib/calculations';
import {
  MAX_HISTORY_POINTS, processReading, reclassify, type ProcessOptions,
} from '../lib/processing';
import { DEFAULT_SETTINGS } from '../lib/settings';

export const MANUAL_REDUCE_ML = 25;
export const MAX_ALERTS = 200;

export interface MonitorState {
  bags: Bag[];
  bagConfigs: BagConfig[];
  sims: Record<string, DemoSim>;
  alerts: AlertEvent[]; // newest first
  settings: Settings;
  running: boolean;
  selectedBagId: string;
  source: MonitorSource;
}

export type MonitorAction =
  | { type: 'TICK'; now: number }
  | { type: 'SENSOR_READING'; reading: SensorReading }
  | { type: 'SET_SOURCE'; source: MonitorSource; liveBagId?: string }
  | { type: 'ADD_BAG'; name: string; initialVolumeMl: number; startVolumeMl: number; flowMlH: number; now: number }
  | { type: 'HYDRATE_HISTORY'; bagId: string; points: DataPoint[] }
  | { type: 'SET_RUNNING'; running: boolean }
  | { type: 'SELECT_BAG'; bagId: string }
  | { type: 'RESET_BAG'; bagId: string; now: number }
  | { type: 'MANUAL_REDUCE'; bagId: string; amountMl: number; now: number }
  | { type: 'SIM_LEVEL'; bagId: string; level: 'LOW' | 'CRITICAL'; now: number }
  | { type: 'SIM_FAULT'; bagId: string; now: number }
  | { type: 'RESTORE_NORMAL'; bagId: string; now: number }
  | { type: 'ACK_BAG'; bagId: string; now: number }
  | { type: 'ACK_ALERT'; id: string; now: number }
  | { type: 'CLEAR_ALERTS' }
  | { type: 'UPDATE_SETTINGS'; settings: Settings; now: number };

const emptyBag = (id: string, name: string, initialVolumeMl: number, now: number): Bag => ({
  id, name, initialVolumeMl, volumeMl: initialVolumeMl, weightG: null, status: 'NORMAL',
  ackedStatus: null, flowMlH: null, lastReadingAt: now, history: [],
});

/** Takes one reading from the demo sensor for a bag and runs it through the pipeline. */
function sample(
  state: MonitorState, bagId: string, sim: DemoSim, now: number, opts: ProcessOptions,
): MonitorState {
  const bag = state.bags.find((b) => b.id === bagId);
  if (!bag) return state;
  const reading = readDemoSensor(bagId, sim, now);
  const { bag: next, alert } = processReading(bag, reading, state.settings, opts);
  return {
    ...state,
    sims: { ...state.sims, [bagId]: sim },
    bags: state.bags.map((b) => (b.id === bagId ? next : b)),
    alerts: alert ? [alert, ...state.alerts].slice(0, MAX_ALERTS) : state.alerts,
  };
}

export function createInitialState(
  settings: Settings = DEFAULT_SETTINGS,
  alerts: AlertEvent[] = [],
  now = Date.now(),
  addedConfigs: BagConfig[] = [],
): MonitorState {
  const bagConfigs = [
    LIVE_BAG_CONFIG,
    ...addedConfigs.filter((config) => config.id !== LIVE_BAG_CONFIG.id),
  ];
  let state: MonitorState = {
    bags: bagConfigs.map((c) => emptyBag(c.id, c.name, c.initialVolumeMl, now)),
    bagConfigs,
    sims: Object.fromEntries(bagConfigs.map((c) => [c.id, createDemoSim(c)])),
    alerts, settings, running: settings.autoUpdates, selectedBagId: LIVE_BAG_CONFIG.id, source: 'SIMULATED',
  };
  for (const c of bagConfigs) state = sample(state, c.id, state.sims[c.id], now, { discontinuity: true });
  return state;
}

export function monitorReducer(state: MonitorState, action: MonitorAction): MonitorState {
  switch (action.type) {
    case 'TICK': {
      if (state.source !== 'SIMULATED' || !state.running || !state.settings.autoUpdates) return state;
      const dt = state.settings.intervalSec * SIM_SPEED;
      let next = state;
      for (const bag of state.bags) {
        next = sample(next, bag.id, stepDemoSim(state.sims[bag.id], dt), action.now, {});
      }
      return next;
    }
    case 'SET_SOURCE': {
      if (action.source === 'SIMULATED') return { ...state, source: 'SIMULATED' };
      const liveBagId = action.liveBagId ?? LIVE_BAG_CONFIG.id;
      return {
        ...state,
        source: action.source,
        bags: state.bags.map((b) => b.id === liveBagId
          ? b
          : { ...b, status: 'SENSOR_FAULT' as const, weightG: null, flowMlH: null, ackedStatus: null }),
      };
    }
    case 'ADD_BAG': {
      const id = nextBagId(state.bagConfigs);
      const config: BagConfig = {
        id, name: action.name, initialVolumeMl: action.initialVolumeMl,
        startVolumeMl: action.startVolumeMl, flowMlH: action.flowMlH,
      };
      const base: MonitorState = {
        ...state,
        bagConfigs: [...state.bagConfigs, config],
        bags: [...state.bags, emptyBag(id, config.name, config.initialVolumeMl, action.now)],
        sims: { ...state.sims, [id]: createDemoSim(config) },
      };
      if (state.source !== 'SIMULATED') {
        return {
          ...base,
          bags: base.bags.map((b) => b.id === id
            ? { ...b, status: 'SENSOR_FAULT' as const, weightG: null, flowMlH: null }
            : b),
        };
      }
      return sample(base, id, base.sims[id], action.now, { discontinuity: true });
    }
    case 'SENSOR_READING': {
      const bag = state.bags.find((b) => b.id === action.reading.bagId);
      if (!bag) return state;
      const { bag: next, alert } = processReading(bag, action.reading, state.settings, { simulated: false });
      return {
        ...state,
        bags: state.bags.map((b) => b.id === next.id ? next : b),
        alerts: alert ? [alert, ...state.alerts].slice(0, MAX_ALERTS) : state.alerts,
      };
    }
    case 'HYDRATE_HISTORY': {
      const bag = state.bags.find((b) => b.id === action.bagId);
      if (!bag || action.points.length === 0) return state;

      // Merge by timestamp so a late history load and the first live snapshot do not duplicate.
      const byTimestamp = new Map<number, DataPoint>();
      for (const point of [...bag.history, ...action.points]) {
        if (Number.isFinite(point.t)) byTimestamp.set(point.t, point);
      }
      const ordered = [...byTimestamp.values()].sort((a, b) => a.t - b.t).slice(-MAX_HISTORY_POINTS);
      const history: DataPoint[] = [];
      for (const point of ordered) {
        const next: DataPoint = { ...point, flowMlH: null };
        history.push(next);
        next.flowMlH = next.volumeMl === null ? null : estimateFlow(history);
      }
      const latest = history[history.length - 1];
      return {
        ...state,
        bags: state.bags.map((b) => (b.id === bag.id
          ? { ...b, history, flowMlH: latest.flowMlH, lastReadingAt: Math.max(b.lastReadingAt, latest.t) }
          : b)),
      };
    }
    case 'SET_RUNNING':
      return { ...state, running: action.running && state.settings.autoUpdates };
    case 'SELECT_BAG':
      return state.bags.some((b) => b.id === action.bagId) ? { ...state, selectedBagId: action.bagId } : state;

    case 'RESET_BAG': {
      const cfg = state.bagConfigs.find((c) => c.id === action.bagId);
      if (!cfg) return state;
      const sim: DemoSim = { ...createDemoSim(cfg), trueVolumeMl: cfg.initialVolumeMl };
      return sample(state, action.bagId, sim, action.now, { discontinuity: true, resetHistory: true });
    }
    case 'MANUAL_REDUCE': {
      const sim = state.sims[action.bagId];
      if (!sim) return state;
      const reduced = { ...sim, trueVolumeMl: Math.max(0, sim.trueVolumeMl - action.amountMl) };
      return sample(state, action.bagId, reduced, action.now, { discontinuity: true });
    }
    case 'SIM_LEVEL': {
      const sim = state.sims[action.bagId];
      if (!sim) return state;
      const { lowMl, criticalMl } = state.settings;
      // LOW: halfway between the two thresholds (so it is <= low and > critical).
      // CRITICAL: 60 % of the critical threshold (0 mL if the threshold is 0).
      const level = action.level === 'LOW' ? (lowMl + criticalMl) / 2 : Math.floor(criticalMl * 0.6);
      return sample(state, action.bagId, { ...sim, trueVolumeMl: level, faultInjected: false }, action.now,
        { discontinuity: true });
    }
    case 'SIM_FAULT': {
      const sim = state.sims[action.bagId];
      if (!sim) return state;
      return sample(state, action.bagId, { ...sim, faultInjected: true }, action.now, { discontinuity: true });
    }
    case 'RESTORE_NORMAL': {
      const sim = state.sims[action.bagId];
      const cfg = state.bagConfigs.find((c) => c.id === action.bagId);
      if (!sim || !cfg) return state;
      let vol = sim.trueVolumeMl;
      if (vol <= state.settings.lowMl) {
        vol = Math.min(cfg.initialVolumeMl, Math.max(cfg.initialVolumeMl * 0.7, state.settings.lowMl + 20));
      }
      return sample(state, action.bagId, { ...sim, faultInjected: false, trueVolumeMl: vol }, action.now,
        { discontinuity: true });
    }

    case 'ACK_BAG': {
      // Acknowledging silences the alarm and marks history rows. It never changes the status.
      const bag = state.bags.find((b) => b.id === action.bagId);
      if (!bag || bag.status === 'NORMAL') return state;
      return {
        ...state,
        bags: state.bags.map((b) => (b.id === bag.id ? { ...b, ackedStatus: b.status } : b)),
        alerts: state.alerts.map((a) =>
          a.bagId === bag.id && !a.acknowledged ? { ...a, acknowledged: true, acknowledgedAt: action.now } : a),
      };
    }
    case 'ACK_ALERT': {
      const alert = state.alerts.find((a) => a.id === action.id);
      if (!alert || alert.acknowledged) return state;
      return {
        ...state,
        alerts: state.alerts.map((a) =>
          a.id === alert.id ? { ...a, acknowledged: true, acknowledgedAt: action.now } : a),
        bags: state.bags.map((b) =>
          b.id === alert.bagId && b.status === alert.type ? { ...b, ackedStatus: b.status } : b),
      };
    }
    case 'CLEAR_ALERTS':
      return { ...state, alerts: [] };

    case 'UPDATE_SETTINGS': {
      const settings = action.settings;
      let running = state.running;
      if (settings.autoUpdates !== state.settings.autoUpdates) running = settings.autoUpdates;
      let alerts = state.alerts;
      const bags = state.bags.map((b) => {
        const r = reclassify(b, settings, action.now, state.source === 'SIMULATED');
        if (r.alert) alerts = [r.alert, ...alerts].slice(0, MAX_ALERTS);
        return r.bag;
      });
      return { ...state, settings, running, bags, alerts };
    }
    default:
      return state;
  }
}
