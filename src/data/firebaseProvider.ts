// READ-ONLY Firebase Realtime Database adapter.
// Converts RTDB snapshots into the same plain objects the rest of DropSafe already uses,
// so the existing calculation/threshold/alert pipeline stays in charge of the dashboard.
import {
  get, limitToLast, onValue, query, ref,
  type Database, type Unsubscribe,
} from 'firebase/database';
import type { BagStatus, DataPoint } from '../types';

export interface CloudBag {
  deviceId: string | null;
  weightG: number | null;
  volumeMl: number | null;
  percent: number | null;
  status: BagStatus;
  sensorOk: boolean;
  alarm: boolean;
  updatedAt: number | null;
  recordedAt: number | null;
}

export interface CloudDevice {
  id: string;
  bagId: string | null;
  lastSeen: number | null;
  firmware: string | null;
  rssi: number | null;
  publishIntervalSec: number | null;
  alarm: boolean;
  sensorOk: boolean;
}

export interface CloudHistoryPoint {
  t: number;
  weightG: number | null;
  volumeMl: number | null;
  percent: number | null;
  status: BagStatus;
}

const BAG_STATUSES: BagStatus[] = ['NORMAL', 'LOW', 'CRITICAL', 'SENSOR_FAULT'];

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const asText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const asStatus = (value: unknown): BagStatus | null =>
  typeof value === 'string' && (BAG_STATUSES as string[]).includes(value) ? (value as BagStatus) : null;

export function parseBag(raw: unknown): CloudBag | null {
  const record = asRecord(raw);
  if (!record) return null;

  const updatedAt = asNumber(record.updatedAt);
  const recordedAt = asNumber(record.recordedAt);
  const weightG = asNumber(record.weightG);
  const sensorOk = record.sensorOk !== false && weightG !== null;
  const volumeMl = sensorOk ? asNumber(record.volumeMl) : null;
  const status: BagStatus = sensorOk ? asStatus(record.status) ?? 'NORMAL' : 'SENSOR_FAULT';

  return {
    deviceId: asText(record.deviceId),
    weightG,
    volumeMl,
    percent: asNumber(record.percent),
    status,
    sensorOk,
    alarm: record.alarm === true,
    updatedAt,
    recordedAt,
  };
}

export function parseDevice(raw: unknown): CloudDevice | null {
  const record = asRecord(raw);
  if (!record) return null;

  const publishIntervalSec = asNumber(record.publishIntervalSec);
  return {
    id: asText(record.id) ?? '',
    bagId: asText(record.bagId),
    lastSeen: asNumber(record.lastSeen),
    firmware: asText(record.firmware),
    rssi: asNumber(record.rssi),
    publishIntervalSec:
      publishIntervalSec !== null && publishIntervalSec >= 1 && publishIntervalSec <= 3600
        ? publishIntervalSec
        : null,
    alarm: record.alarm === true,
    sensorOk: record.sensorOk !== false,
  };
}

export function parseHistoryPoint(raw: unknown): CloudHistoryPoint | null {
  const record = asRecord(raw);
  if (!record) return null;
  const t = asNumber(record.t);
  if (t === null || t <= 0) return null;
  return {
    t,
    weightG: asNumber(record.weightG),
    volumeMl: asNumber(record.volumeMl),
    percent: asNumber(record.percent),
    status: asStatus(record.status) ?? 'NORMAL',
  };
}

export function toDataPoint(point: CloudHistoryPoint): DataPoint {
  return {
    t: point.t,
    simS: point.t / 1000,
    volumeMl: point.volumeMl,
    weightG: point.weightG,
    flowMlH: null,
  };
}

export function subscribeToBag(
  db: Database,
  bagId: string,
  onBag: (bag: CloudBag) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  return onValue(ref(db, `monitoring/bags/${bagId}`), (snapshot) => {
    const bag = parseBag(snapshot.val());
    if (bag && (bag.updatedAt !== null || bag.recordedAt !== null || bag.weightG !== null)) onBag(bag);
  }, onError);
}

export function subscribeToDevice(
  db: Database,
  deviceId: string,
  onDevice: (device: CloudDevice) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  return onValue(ref(db, `monitoring/device/${deviceId}`), (snapshot) => {
    const device = parseDevice(snapshot.val());
    if (device) onDevice(device);
  }, onError);
}

export function subscribeToConnection(
  db: Database,
  onChange: (connected: boolean) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  return onValue(ref(db, '.info/connected'), (snapshot) => {
    onChange(snapshot.val() === true);
  }, onError);
}

/** Loads the most recent history points once. Live updates come from subscribeToBag. */
export async function loadHistory(
  db: Database,
  bagId: string,
  maxPoints: number,
): Promise<CloudHistoryPoint[]> {
  const snapshot = await get(query(ref(db, `monitoring/history/${bagId}`), limitToLast(maxPoints)));
  const byTimestamp = new Map<number, CloudHistoryPoint>();
  snapshot.forEach((child) => {
    const point = parseHistoryPoint(child.val());
    if (point) byTimestamp.set(point.t, point);
  });
  return [...byTimestamp.values()].sort((a, b) => a.t - b.t);
}
