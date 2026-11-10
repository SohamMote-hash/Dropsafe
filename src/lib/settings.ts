import type { Settings } from '../types';
import { isFiniteNumber } from './calculations';

export const DEFAULT_SETTINGS: Settings = {
  lowMl: 100,
  criticalMl: 25,
  intervalSec: 2,
  soundEnabled: false, // browsers need a click before audio, so it starts off
  autoUpdates: true,
};

export const LIMITS = { maxThresholdMl: 500, minIntervalSec: 1, maxIntervalSec: 30 };

export type SettingsErrors = Partial<Record<'lowMl' | 'criticalMl' | 'intervalSec', string>>;

/** Returns an object of error messages; empty object means the settings are valid. */
export function validateSettings(s: Partial<Record<keyof Settings, unknown>>): SettingsErrors {
  const errors: SettingsErrors = {};
  const low = s.lowMl;
  const crit = s.criticalMl;
  const interval = s.intervalSec;

  if (!isFiniteNumber(low)) errors.lowMl = 'Enter a number.';
  else if (low < 0) errors.lowMl = 'Must be 0 or more.';
  else if (low > LIMITS.maxThresholdMl) errors.lowMl = `Must be at most ${LIMITS.maxThresholdMl} mL.`;

  if (!isFiniteNumber(crit)) errors.criticalMl = 'Enter a number.';
  else if (crit < 0) errors.criticalMl = 'Must be 0 or more.';

  if (!errors.lowMl && !errors.criticalMl && isFiniteNumber(low) && isFiniteNumber(crit) && crit >= low) {
    errors.criticalMl = 'Critical threshold must be lower than the low threshold.';
  }

  if (!isFiniteNumber(interval)) errors.intervalSec = 'Enter a number.';
  else if (interval < LIMITS.minIntervalSec || interval > LIMITS.maxIntervalSec) {
    errors.intervalSec = `Must be between ${LIMITS.minIntervalSec} and ${LIMITS.maxIntervalSec} seconds.`;
  }
  return errors;
}

export const isValidSettings = (s: Partial<Record<keyof Settings, unknown>>) =>
  Object.keys(validateSettings(s)).length === 0 &&
  typeof s.soundEnabled === 'boolean' &&
  typeof s.autoUpdates === 'boolean';
