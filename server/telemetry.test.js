import { describe, expect, it } from 'vitest';
import { classifyVolume, validateTelemetry } from './telemetry.js';

const cfg = {
  deviceId: 'dropsafe-01',
  bagId: 'IV-01',
  maxLoadG: 5000,
  initialVolumeMl: 500,
  emptyBagTareG: 30,
  densityGPerMl: 1.005,
  thresholds: { lowMl: 100, criticalMl: 25 },
};

const payload = (overrides = {}) => ({
  deviceId: 'dropsafe-01',
  bagId: 'IV-01',
  firmware: '1.0.0',
  sensorOk: true,
  weightG: 530,
  volumeMl: 497.5,
  percent: 99.5,
  status: 'NORMAL',
  alarm: false,
  rssi: -58,
  uptimeSec: 12,
  publishIntervalSec: 5,
  recordedAt: Date.now(),
  ...overrides,
});

describe('classifyVolume', () => {
  it('classifies by the configured thresholds', () => {
    expect(classifyVolume(500, 100, 25)).toBe('NORMAL');
    expect(classifyVolume(101, 100, 25)).toBe('NORMAL');
    expect(classifyVolume(100, 100, 25)).toBe('LOW');
    expect(classifyVolume(26, 100, 25)).toBe('LOW');
    expect(classifyVolume(25, 100, 25)).toBe('CRITICAL');
    expect(classifyVolume(0, 100, 25)).toBe('CRITICAL');
  });

  it('treats a non-finite volume as a sensor fault', () => {
    expect(classifyVolume(NaN, 100, 25)).toBe('SENSOR_FAULT');
    expect(classifyVolume(null, 100, 25)).toBe('SENSOR_FAULT');
    expect(classifyVolume(undefined, 100, 25)).toBe('SENSOR_FAULT');
  });
});

describe('validateTelemetry', () => {
  it('accepts a valid payload and normalizes it', () => {
    const now = Date.now();
    const result = validateTelemetry(payload({ recordedAt: now }), cfg);
    expect(result.ok).toBe(true);
    expect(result.value).toMatchObject({
      deviceId: 'dropsafe-01',
      bagId: 'IV-01',
      firmware: '1.0.0',
      weightG: 530,
      volumeMl: 497.5,
      percent: 99.5,
      status: 'NORMAL',
      sensorFault: false,
      alarm: false,
      rssi: -58,
      uptimeSec: 12,
      publishIntervalSec: 5,
      recordedAt: now,
    });
    expect(result.value.receivedAt).toBeGreaterThanOrEqual(now);
  });

  it('recalculates status instead of trusting the device', () => {
    // Device claims NORMAL, but 51 g is below the 100 mL LOW threshold.
    const result = validateTelemetry(payload({ weightG: 51, volumeMl: 21, status: 'NORMAL' }), cfg);
    expect(result.ok).toBe(true);
    expect(result.value.status).toBe('CRITICAL');

    const low = validateTelemetry(payload({ weightG: 121, volumeMl: 90, status: 'NORMAL' }), cfg);
    expect(low.value.status).toBe('LOW');
  });

  it('computes volume from weight when the device omits it', () => {
    const result = validateTelemetry(payload({ weightG: 530, volumeMl: undefined }), cfg);
    expect(result.value.volumeMl).toBe(497.5);
    expect(result.value.percent).toBe(99.5);
  });

  it('ignores a client-reported volume that disagrees with weight', () => {
    const result = validateTelemetry(payload({ weightG: 530, volumeMl: 10 }), cfg);
    expect(result.value.volumeMl).toBe(497.5);
    expect(result.value.status).toBe('NORMAL');
  });

  it('clamps an implausible computed volume to 125 % of the bag', () => {
    const result = validateTelemetry(payload({ weightG: 5000, volumeMl: 100_000 }), cfg);
    expect(result.value.volumeMl).toBe(625);
    expect(result.value.percent).toBe(100);
  });

  it('clamps a below-tare weight to an empty bag', () => {
    const result = validateTelemetry(payload({ weightG: 10 }), cfg);
    expect(result.value.volumeMl).toBe(0);
    expect(result.value.percent).toBe(0);
    expect(result.value.status).toBe('CRITICAL');
  });

  it('flags a sensor fault and nulls the physical values', () => {
    const result = validateTelemetry(payload({ sensorOk: false }), cfg);
    expect(result.ok).toBe(true);
    expect(result.value.sensorFault).toBe(true);
    expect(result.value.weightG).toBeNull();
    expect(result.value.volumeMl).toBeNull();
    expect(result.value.percent).toBe(0);
    expect(result.value.status).toBe('SENSOR_FAULT');
  });

  it('flags a sensor fault when weightG is missing', () => {
    const result = validateTelemetry(payload({ weightG: null }), cfg);
    expect(result.value.sensorFault).toBe(true);
    expect(result.value.status).toBe('SENSOR_FAULT');
  });

  it('rejects non-object bodies', () => {
    for (const body of [null, undefined, 'x', 7, []]) {
      expect(validateTelemetry(body, cfg)).toMatchObject({ ok: false });
    }
  });

  it('rejects an unknown device or bag', () => {
    expect(validateTelemetry(payload({ deviceId: 'other' }), cfg))
      .toMatchObject({ ok: false, error: 'Unknown device.' });
    expect(validateTelemetry(payload({ bagId: 'IV-99' }), cfg))
      .toMatchObject({ ok: false, error: 'Unknown bag.' });
    expect(validateTelemetry(payload({ deviceId: undefined }), cfg))
      .toMatchObject({ ok: false, error: 'Unknown device.' });
  });

  it('rejects weight outside 0..maxLoadG', () => {
    expect(validateTelemetry(payload({ weightG: -1 }), cfg)).toMatchObject({ ok: false });
    expect(validateTelemetry(payload({ weightG: 6000 }), cfg)).toMatchObject({ ok: false });
    expect(validateTelemetry(payload({ weightG: '530' }), cfg)).toMatchObject({ ok: false });
  });

  it('clamps an out-of-range recordedAt to now', () => {
    const now = Date.now();
    const stale = validateTelemetry(payload({ recordedAt: now - 48 * 60 * 60 * 1000 }), cfg);
    expect(Math.abs(stale.value.recordedAt - now)).toBeLessThan(5_000);

    const future = validateTelemetry(payload({ recordedAt: now + 60 * 60 * 1000 }), cfg);
    expect(Math.abs(future.value.recordedAt - now)).toBeLessThan(5_000);
  });

  it('sanitizes metadata', () => {
    const result = validateTelemetry(payload({
      firmware: '  v1.2.3<script>  ',
      rssi: -500,
      uptimeSec: -4,
      publishIntervalSec: 0,
      alarm: 'yes',
    }), cfg);
    expect(result.value.firmware).toBe('v1.2.3script');
    expect(result.value.rssi).toBeNull();
    expect(result.value.uptimeSec).toBeNull();
    expect(result.value.publishIntervalSec).toBe(5);
    expect(result.value.alarm).toBe(false);
  });

  it('truncates long firmware strings', () => {
    const result = validateTelemetry(payload({ firmware: 'a'.repeat(100) }), cfg);
    expect(result.value.firmware).toHaveLength(40);
  });
});
