import { describe, expect, it } from 'vitest';
import { classifyStatus, alertTypeFor, SEVERITY } from './status';

describe('classifyStatus', () => {
  const thresholds = { lowMl: 100, criticalMl: 25 };

  it('returns NORMAL above the low threshold', () => {
    expect(classifyStatus(250, thresholds)).toBe('NORMAL');
    expect(classifyStatus(101, thresholds)).toBe('NORMAL');
  });
  it('returns LOW at the low threshold', () =>
    expect(classifyStatus(100, thresholds)).toBe('LOW'));
  it('returns LOW between the two thresholds', () =>
    expect(classifyStatus(50, thresholds)).toBe('LOW'));
  it('returns CRITICAL at the critical threshold', () =>
    expect(classifyStatus(25, thresholds)).toBe('CRITICAL'));
  it('returns CRITICAL below the critical threshold', () =>
    expect(classifyStatus(0, thresholds)).toBe('CRITICAL'));
  it('CRITICAL wins over LOW when critically low', () =>
    expect(classifyStatus(10, thresholds)).toBe('CRITICAL'));
  it('returns SENSOR_FAULT for null volume', () =>
    expect(classifyStatus(null, thresholds)).toBe('SENSOR_FAULT'));
  it('returns SENSOR_FAULT for NaN volume', () =>
    expect(classifyStatus(NaN, thresholds)).toBe('SENSOR_FAULT'));
});

describe('alertTypeFor', () => {
  it('returns null for NORMAL', () => expect(alertTypeFor('NORMAL')).toBeNull());
  it('returns LOW for LOW', () => expect(alertTypeFor('LOW')).toBe('LOW'));
  it('returns CRITICAL for CRITICAL', () => expect(alertTypeFor('CRITICAL')).toBe('CRITICAL'));
  it('returns SENSOR_FAULT for SENSOR_FAULT', () =>
    expect(alertTypeFor('SENSOR_FAULT')).toBe('SENSOR_FAULT'));
});

describe('SEVERITY ordering', () => {
  it('CRITICAL is most severe', () => {
    expect(SEVERITY.CRITICAL).toBeGreaterThan(SEVERITY.SENSOR_FAULT);
    expect(SEVERITY.CRITICAL).toBeGreaterThan(SEVERITY.LOW);
  });
  it('SENSOR_FAULT is more severe than LOW', () =>
    expect(SEVERITY.SENSOR_FAULT).toBeGreaterThan(SEVERITY.LOW));
});
