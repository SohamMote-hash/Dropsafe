import { describe, expect, it } from 'vitest';
import { validateSettings, isValidSettings, DEFAULT_SETTINGS, LIMITS } from './settings';

describe('validateSettings', () => {
  it('returns no errors for default settings', () =>
    expect(validateSettings(DEFAULT_SETTINGS)).toEqual({}));

  it('errors when lowMl is not a number', () =>
    expect(validateSettings({ ...DEFAULT_SETTINGS, lowMl: 'x' as unknown as number })).toHaveProperty('lowMl'));

  it('errors when lowMl is negative', () =>
    expect(validateSettings({ ...DEFAULT_SETTINGS, lowMl: -1 })).toHaveProperty('lowMl'));

  it('errors when lowMl exceeds the max', () =>
    expect(validateSettings({ ...DEFAULT_SETTINGS, lowMl: LIMITS.maxThresholdMl + 1 })).toHaveProperty('lowMl'));

  it('errors when criticalMl is not a number', () =>
    expect(validateSettings({ ...DEFAULT_SETTINGS, criticalMl: NaN })).toHaveProperty('criticalMl'));

  it('errors when criticalMl >= lowMl', () =>
    expect(validateSettings({ ...DEFAULT_SETTINGS, lowMl: 50, criticalMl: 50 })).toHaveProperty('criticalMl'));

  it('errors when criticalMl > lowMl', () =>
    expect(validateSettings({ ...DEFAULT_SETTINGS, lowMl: 50, criticalMl: 60 })).toHaveProperty('criticalMl'));

  it('errors when intervalSec is below the minimum', () =>
    expect(validateSettings({ ...DEFAULT_SETTINGS, intervalSec: 0 })).toHaveProperty('intervalSec'));

  it('errors when intervalSec exceeds the maximum', () =>
    expect(validateSettings({ ...DEFAULT_SETTINGS, intervalSec: LIMITS.maxIntervalSec + 1 })).toHaveProperty('intervalSec'));

  it('allows criticalMl of 0 with lowMl > 0', () =>
    expect(validateSettings({ ...DEFAULT_SETTINGS, lowMl: 10, criticalMl: 0 })).toEqual({}));
});

describe('isValidSettings', () => {
  it('returns true for default settings', () =>
    expect(isValidSettings(DEFAULT_SETTINGS)).toBe(true));

  it('returns false when soundEnabled is missing', () =>
    expect(isValidSettings({ ...DEFAULT_SETTINGS, soundEnabled: undefined as unknown as boolean })).toBe(false));

  it('returns false when autoUpdates is not boolean', () =>
    expect(isValidSettings({ ...DEFAULT_SETTINGS, autoUpdates: 1 as unknown as boolean })).toBe(false));

  it('returns false when there are numeric validation errors', () =>
    expect(isValidSettings({ ...DEFAULT_SETTINGS, lowMl: -5 })).toBe(false));
});
