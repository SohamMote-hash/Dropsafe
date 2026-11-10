import { describe, expect, it } from 'vitest';
import { parseBag, parseDevice, parseHistoryPoint, toDataPoint } from './firebaseProvider';

describe('parseBag', () => {
  it('parses a complete RTDB record', () => {
    const bag = parseBag({
      deviceId: 'dropsafe-01',
      weightG: 530,
      volumeMl: 497.5,
      percent: 99.5,
      status: 'NORMAL',
      sensorOk: true,
      alarm: false,
      updatedAt: 1_700_000_000_000,
      recordedAt: 1_699_999_999_000,
    });
    expect(bag).toEqual({
      deviceId: 'dropsafe-01',
      weightG: 530,
      volumeMl: 497.5,
      percent: 99.5,
      status: 'NORMAL',
      sensorOk: true,
      alarm: false,
      updatedAt: 1_700_000_000_000,
      recordedAt: 1_699_999_999_000,
    });
  });

  it('rejects non-object values', () => {
    expect(parseBag(null)).toBeNull();
    expect(parseBag(undefined)).toBeNull();
    expect(parseBag('bag')).toBeNull();
    expect(parseBag([1, 2])).toBeNull();
  });

  it('marks a missing weight as a sensor fault', () => {
    const bag = parseBag({ status: 'NORMAL', updatedAt: 1_700_000_000_000 });
    expect(bag?.sensorOk).toBe(false);
    expect(bag?.volumeMl).toBeNull();
    expect(bag?.status).toBe('SENSOR_FAULT');
  });

  it('honours an explicit sensorOk:false from the gateway', () => {
    const bag = parseBag({ sensorOk: false, status: 'SENSOR_FAULT', weightG: 510, updatedAt: 1 });
    expect(bag?.sensorOk).toBe(false);
    expect(bag?.volumeMl).toBeNull();
    expect(bag?.status).toBe('SENSOR_FAULT');
  });

  it('ignores an unknown status and falls back', () => {
    expect(parseBag({ weightG: 400, status: 'WHATEVER', updatedAt: 1 })?.status).toBe('NORMAL');
  });

  it('coerces bad numeric fields to null and trims text', () => {
    const bag = parseBag({
      deviceId: '  dropsafe-01  ',
      weightG: '530',
      percent: NaN,
      updatedAt: 'now',
      recordedAt: Infinity,
    });
    expect(bag?.deviceId).toBe('dropsafe-01');
    expect(bag?.weightG).toBeNull();
    expect(bag?.percent).toBeNull();
    expect(bag?.updatedAt).toBeNull();
    expect(bag?.recordedAt).toBeNull();
    expect(bag?.sensorOk).toBe(false);
  });
});

describe('parseDevice', () => {
  it('parses a heartbeat', () => {
    const device = parseDevice({
      id: 'dropsafe-01',
      bagId: 'IV-01',
      lastSeen: 1_700_000_000_000,
      firmware: ' 1.0.0 ',
      rssi: -58,
      publishIntervalSec: 5,
      alarm: true,
      sensorOk: true,
    });
    expect(device).toEqual({
      id: 'dropsafe-01',
      bagId: 'IV-01',
      lastSeen: 1_700_000_000_000,
      firmware: '1.0.0',
      rssi: -58,
      publishIntervalSec: 5,
      alarm: true,
      sensorOk: true,
    });
  });

  it('rejects non-object values', () => {
    expect(parseDevice(null)).toBeNull();
    expect(parseDevice(42)).toBeNull();
  });

  it('falls back to an empty id and null interval when invalid', () => {
    const device = parseDevice({ publishIntervalSec: 0, sensorOk: false });
    expect(device?.id).toBe('');
    expect(device?.bagId).toBeNull();
    expect(device?.firmware).toBeNull();
    expect(device?.publishIntervalSec).toBeNull();
    expect(device?.sensorOk).toBe(false);
    expect(device?.alarm).toBe(false);
  });
});

describe('parseHistoryPoint', () => {
  it('parses a stored point', () => {
    expect(parseHistoryPoint({
      t: 1_700_000_000_000,
      weightG: 530,
      volumeMl: 497.5,
      percent: 99.5,
      status: 'LOW',
    })).toEqual({
      t: 1_700_000_000_000,
      weightG: 530,
      volumeMl: 497.5,
      percent: 99.5,
      status: 'LOW',
    });
  });

  it('requires a positive timestamp', () => {
    expect(parseHistoryPoint({ volumeMl: 100 })).toBeNull();
    expect(parseHistoryPoint({ t: 0, volumeMl: 100 })).toBeNull();
    expect(parseHistoryPoint({ t: -5 })).toBeNull();
    expect(parseHistoryPoint(null)).toBeNull();
  });

  it('defaults an unknown status to NORMAL', () => {
    expect(parseHistoryPoint({ t: 10, status: 'BOGUS' })?.status).toBe('NORMAL');
  });
});

describe('toDataPoint', () => {
  it('maps a cloud point into the dashboard point shape', () => {
    expect(toDataPoint({
      t: 1_700_000_000_000,
      weightG: 530,
      volumeMl: 497.5,
      percent: 99.5,
      status: 'NORMAL',
    })).toEqual({
      t: 1_700_000_000_000,
      simS: 1_700_000_000,
      volumeMl: 497.5,
      weightG: 530,
      flowMlH: null,
    });
  });
});
