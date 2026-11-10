// DATA SOURCE LAYER.
// Everything that "makes up" sensor data lives here. The rest of the app only sees
// `SensorReading` objects, so this file is the only one to replace when real hardware
// (Arduino Nano ESP32 + HX711) is connected.
import type { DemoSim, SensorReading } from '../types';
import { weightFromVolume } from '../lib/calculations';

/**
 * Contract for a future real data source (e.g. a WebSocket / HTTP / Web Serial reader that
 * receives weights from the microcontroller). NOT implemented in this prototype.
 */
export interface SensorProvider {
  /** 'SIMULATED' until a real source is configured. */
  readonly kind: 'SIMULATED' | 'HARDWARE';
  /** Start receiving readings; returns an unsubscribe function. */
  subscribe(onReading: (reading: SensorReading) => void): () => void;
}

export const CONNECTION_KIND: SensorProvider['kind'] = 'SIMULATED';

/** 1 real second = 120 simulated seconds, so a demo bag drains in minutes, not hours. */
export const SIM_SPEED = 120;

export interface BagConfig {
  id: string;
  name: string;
  initialVolumeMl: number;
  startVolumeMl: number;
  flowMlH: number;
}

/** The single built-in channel that also receives Firebase readings. */
export const LIVE_BAG_CONFIG: BagConfig = {
  id: 'IV-01', name: 'Live channel', initialVolumeMl: 500, startVolumeMl: 420, flowMlH: 120,
};

/** Returns the lowest unused channel number, starting at IV-02. */
export function nextBagId(configs: BagConfig[]): string {
  const used = new Set(configs.map((config) => config.id));
  let n = 2;
  while (used.has(`IV-${String(n).padStart(2, '0')}`)) n += 1;
  return `IV-${String(n).padStart(2, '0')}`;
}

export const createDemoSim = (c: BagConfig): DemoSim => ({
  trueVolumeMl: c.startVolumeMl,
  targetFlowMlH: c.flowMlH,
  faultInjected: false,
  simSeconds: 0,
});

/** Advances the pretend physical bag by `dtSimSeconds` of simulated time. */
export function stepDemoSim(sim: DemoSim, dtSimSeconds: number, rand: () => number = Math.random): DemoSim {
  const jitter = 1 + (rand() - 0.5) * 0.06; // +/-3 % drip variation
  const drained = (sim.targetFlowMlH * jitter * dtSimSeconds) / 3600;
  return {
    ...sim,
    trueVolumeMl: Math.max(0, sim.trueVolumeMl - drained),
    simSeconds: sim.simSeconds + dtSimSeconds,
  };
}

/**
 * Turns the pretend bag into a fake load-cell weight (with a little noise), exactly like
 * the HX711 would report. If a fault is injected the weight is null (disconnected sensor).
 */
export function readDemoSensor(
  bagId: string,
  sim: DemoSim,
  now: number,
  rand: () => number = Math.random,
): SensorReading {
  const noiseG = (rand() - 0.5) * 0.6;
  return {
    bagId,
    timestamp: now,
    simSeconds: sim.simSeconds,
    weightG: sim.faultInjected ? null : weightFromVolume(sim.trueVolumeMl) + noiseG,
  };
}
