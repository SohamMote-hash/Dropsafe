import { describe, expect, it } from 'vitest';
import {
  clamp,
  estimateFlow,
  EMPTY_BAG_TARE_G,
  FLUID_DENSITY_G_PER_ML,
  flowRateMlPerHour,
  isFiniteNumber,
  MAX_FLOW_ML_H,
  remainingPercent,
  roundTo,
  timeToEmptyHours,
  volumeFromWeight,
  weightFromVolume,
} from './calculations';
import type { DataPoint } from '../types';

// ─── isFiniteNumber ────────────────────────────────────────────────────────────
describe('isFiniteNumber', () => {
  it('returns true for regular numbers', () => {
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(3.14)).toBe(true);
    expect(isFiniteNumber(-100)).toBe(true);
  });
  it('returns false for Infinity and -Infinity', () => {
    expect(isFiniteNumber(Infinity)).toBe(false);
    expect(isFiniteNumber(-Infinity)).toBe(false);
  });
  it('returns false for NaN', () => expect(isFiniteNumber(NaN)).toBe(false));
  it('returns false for non-numbers', () => {
    expect(isFiniteNumber('5')).toBe(false);
    expect(isFiniteNumber(null)).toBe(false);
    expect(isFiniteNumber(undefined)).toBe(false);
  });
});

// ─── clamp ────────────────────────────────────────────────────────────────────
describe('clamp', () => {
  it('returns the value when within bounds', () => expect(clamp(50, 0, 100)).toBe(50));
  it('clamps to min', () => expect(clamp(-5, 0, 100)).toBe(0));
  it('clamps to max', () => expect(clamp(150, 0, 100)).toBe(100));
  it('handles equal min and max', () => expect(clamp(999, 42, 42)).toBe(42));
});

// ─── roundTo ──────────────────────────────────────────────────────────────────
describe('roundTo', () => {
  it('rounds to 1 decimal by default', () => expect(roundTo(3.14159)).toBe(3.1));
  it('rounds to specified digits', () => expect(roundTo(3.14159, 2)).toBe(3.14));
  it('rounds up correctly', () => expect(roundTo(2.75, 1)).toBe(2.8));
  it('handles integers', () => expect(roundTo(5, 0)).toBe(5));
});

// ─── remainingPercent ─────────────────────────────────────────────────────────
describe('remainingPercent', () => {
  it('returns 100 when full', () => expect(remainingPercent(500, 500)).toBe(100));
  it('returns 50 when half full', () => expect(remainingPercent(250, 500)).toBe(50));
  it('returns 0 when empty', () => expect(remainingPercent(0, 500)).toBe(0));
  it('clamps above 100 (overfill)', () => expect(remainingPercent(600, 500)).toBe(100));
  it('clamps below 0 (negative volume)', () => expect(remainingPercent(-10, 500)).toBe(0));
  it('returns 0 when initial volume is 0 (division guard)', () =>
    expect(remainingPercent(50, 0)).toBe(0));
  it('returns 0 for NaN inputs', () =>
    expect(remainingPercent(NaN, 500)).toBe(0));
});

// ─── volumeFromWeight ─────────────────────────────────────────────────────────
describe('volumeFromWeight', () => {
  it('calculates volume correctly', () => {
    // weightG = volume * density + tare  →  volume = (weightG - tare) / density
    const volume = (200 * FLUID_DENSITY_G_PER_ML + EMPTY_BAG_TARE_G);
    expect(volumeFromWeight(volume)).toBeCloseTo(200, 0);
  });
  it('never returns negative volume', () =>
    expect(volumeFromWeight(EMPTY_BAG_TARE_G - 10)).toBe(0));
  it('returns null when weight is not a finite number', () =>
    expect(volumeFromWeight(NaN)).toBeNull());
  it('returns null when density is zero', () =>
    expect(volumeFromWeight(100, 30, 0)).toBeNull());
});

// ─── weightFromVolume ─────────────────────────────────────────────────────────
describe('weightFromVolume', () => {
  it('is the inverse of volumeFromWeight', () => {
    const vol = 250;
    const w = weightFromVolume(vol);
    expect(volumeFromWeight(w)).toBeCloseTo(vol, 1);
  });
  it('returns tare weight when volume is 0', () =>
    expect(weightFromVolume(0)).toBe(EMPTY_BAG_TARE_G));
});

// ─── flowRateMlPerHour ────────────────────────────────────────────────────────
describe('flowRateMlPerHour', () => {
  it('returns correct rate for simple case', () => {
    // 100 mL drained over 3600 s = 100 mL/h
    expect(flowRateMlPerHour(100, 0, 3600)).toBeCloseTo(100, 5);
  });
  it('returns null when elapsed time is 0', () =>
    expect(flowRateMlPerHour(100, 90, 0)).toBeNull());
  it('returns null for a rising level (negative rate)', () =>
    expect(flowRateMlPerHour(80, 100, 3600)).toBeNull());
  it('returns null when rate exceeds MAX_FLOW_ML_H', () =>
    expect(flowRateMlPerHour(MAX_FLOW_ML_H + 1, 0, 3600)).toBeNull());
  it('returns null for non-finite inputs', () =>
    expect(flowRateMlPerHour(NaN, 0, 3600)).toBeNull());
  it('returns 0 when no fluid was consumed', () =>
    expect(flowRateMlPerHour(100, 100, 3600)).toBe(0));
});

// ─── estimateFlow ─────────────────────────────────────────────────────────────
describe('estimateFlow', () => {
  const makePoint = (volumeMl: number, simS: number, disc?: boolean): DataPoint => ({
    t: simS * 1000, simS, volumeMl, weightG: null, flowMlH: null, discontinuity: disc,
  });

  it('returns null when there are fewer than 2 points', () => {
    expect(estimateFlow([])).toBeNull();
    expect(estimateFlow([makePoint(100, 0)])).toBeNull();
  });

  it('returns a positive flow rate for a draining bag', () => {
    const points = [
      makePoint(200, 0),
      makePoint(100, 3600), // 100 mL in 3600 sim-seconds = 100 mL/h
    ];
    expect(estimateFlow(points)).toBeCloseTo(100, 0);
  });

  it('stops at a discontinuity', () => {
    const points = [
      makePoint(500, 0),      // far older — before the discontinuity
      makePoint(300, 3600, true), // manual reset — discontinuity
      makePoint(250, 4200),   // 50 mL in 600 s = 300 mL/h
      makePoint(200, 4800),
    ];
    // Should NOT use the 500 point before the discontinuity
    const rate = estimateFlow(points);
    expect(rate).not.toBeNull();
    expect(rate as number).toBeGreaterThan(0);
    // 100 mL over 1200 sim-seconds = 300 mL/h
    expect(rate as number).toBeCloseTo(300, -1);
  });

  it('skips null (faulty) volume points', () => {
    const faultyPoint: DataPoint = { t: 1800000, simS: 1800, volumeMl: null, weightG: null, flowMlH: null };
    const points: DataPoint[] = [makePoint(200, 0), faultyPoint, makePoint(100, 3600)];
    const rate = estimateFlow(points);
    expect(rate).toBeCloseTo(100, 0);
  });
});

// ─── timeToEmptyHours ─────────────────────────────────────────────────────────
describe('timeToEmptyHours', () => {
  it('returns correct hours', () => expect(timeToEmptyHours(200, 100)).toBeCloseTo(2));
  it('returns 0 when volume is already 0', () => expect(timeToEmptyHours(0, 100)).toBe(0));
  it('returns null when flow is 0', () => expect(timeToEmptyHours(100, 0)).toBeNull());
  it('returns null when flow is negative', () => expect(timeToEmptyHours(100, -10)).toBeNull());
  it('returns null when flow is null', () => expect(timeToEmptyHours(100, null)).toBeNull());
  it('returns null for negative volume', () => expect(timeToEmptyHours(-1, 50)).toBeNull());
  it('returns null for NaN volume', () => expect(timeToEmptyHours(NaN, 50)).toBeNull());
});
