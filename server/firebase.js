// Firebase Admin access. These credentials stay on the server; the browser only ever
// reads through the public read-only rules in firebase/database.rules.json.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applicationDefault, cert, initializeApp } from 'firebase-admin/app';
import { getDatabase, ServerValue } from 'firebase-admin/database';

let acceptedSincePrune = 0;

function loadCredential(config) {
  if (config.serviceAccountJson) {
    return cert(JSON.parse(config.serviceAccountJson));
  }
  if (config.serviceAccountPath) {
    const path = resolve(config.serviceAccountPath);
    let raw;
    try {
      raw = readFileSync(path, 'utf8');
    } catch {
      throw new Error(`Cannot read the Firebase service account at ${path}.`);
    }
    return cert(JSON.parse(raw));
  }
  // For Google Cloud / Cloud Run deployments that provide Application Default Credentials.
  return applicationDefault();
}

export function initRealtimeDatabase(config) {
  const app = initializeApp(
    { credential: loadCredential(config), databaseURL: config.databaseUrl },
    'dropsafe-gateway',
  );
  return getDatabase(app);
}

/** Publishes the gateway's effective limits so the schema is self-documenting. */
export async function publishConfig(db, config) {
  await db.ref('monitoring/config').update({
    schemaVersion: 1,
    bagId: config.bagId,
    deviceId: config.deviceId,
    thresholds: { lowMl: config.thresholds.lowMl, criticalMl: config.thresholds.criticalMl },
    initialVolumeMl: config.initialVolumeMl,
    emptyBagTareG: config.emptyBagTareG,
    fluidDensityGPerMl: config.densityGPerMl,
    maxLoadG: config.maxLoadG,
    historyLimit: config.maxHistoryPoints,
    updatedAt: ServerValue.TIMESTAMP,
  });
}

async function pruneHistory(db, config, bagId) {
  acceptedSincePrune += 1;
  if (acceptedSincePrune % 20 !== 0) return;

  const historyRef = db.ref(`monitoring/history/${bagId}`);
  const newest = await historyRef.orderByKey().limitToLast(config.maxHistoryPoints + 1).get();
  if (newest.numChildren() <= config.maxHistoryPoints) return;

  const keys = Object.keys(newest.val() ?? {});
  const cutoff = keys[0];
  if (!cutoff) return;

  const oldEntries = await historyRef.orderByKey().endAt(cutoff).get();
  const updates = {};
  for (const key of Object.keys(oldEntries.val() ?? {})) {
    updates[`monitoring/history/${bagId}/${key}`] = null;
  }
  if (Object.keys(updates).length > 0) await db.ref().update(updates);
}

/**
 * Atomically writes current state, a history point and the device heartbeat.
 * History uses the device timestamp as its key, so retries after a reconnect are idempotent.
 */
export async function writeTelemetry(db, config, telemetry) {
  const now = Date.now();
  const bagPath = `monitoring/bags/${telemetry.bagId}`;
  const historyKey = String(telemetry.recordedAt);

  const currentSnapshot = await db.ref(bagPath).get();
  const currentRecordedAt = Number(currentSnapshot.val()?.recordedAt);
  const isNewer = !Number.isFinite(currentRecordedAt) || telemetry.recordedAt >= currentRecordedAt;

  const updates = {
    [`monitoring/history/${telemetry.bagId}/${historyKey}`]: {
      t: telemetry.recordedAt,
      weightG: telemetry.weightG,
      volumeMl: telemetry.volumeMl,
      percent: telemetry.percent,
      status: telemetry.status,
      sensorOk: !telemetry.sensorFault,
      receivedAt: telemetry.receivedAt,
    },
    [`monitoring/device/${config.deviceId}`]: {
      id: config.deviceId,
      bagId: telemetry.bagId,
      online: true,
      lastSeen: ServerValue.TIMESTAMP,
      lastRecordedAt: telemetry.recordedAt,
      firmware: telemetry.firmware,
      rssi: telemetry.rssi,
      uptimeSec: telemetry.uptimeSec,
      publishIntervalSec: telemetry.publishIntervalSec,
      alarm: telemetry.alarm,
      sensorOk: !telemetry.sensorFault,
    },
  };

  if (isNewer) {
    updates[bagPath] = {
      bagId: telemetry.bagId,
      deviceId: config.deviceId,
      weightG: telemetry.weightG,
      volumeMl: telemetry.volumeMl,
      percent: telemetry.percent,
      status: telemetry.status,
      sensorOk: !telemetry.sensorFault,
      alarm: telemetry.alarm,
      thresholds: {
        lowMl: config.thresholds.lowMl,
        criticalMl: config.thresholds.criticalMl,
      },
      initialVolumeMl: config.initialVolumeMl,
      recordedAt: telemetry.recordedAt,
      updatedAt: ServerValue.TIMESTAMP,
      receivedAt: now,
    };
  }

  await db.ref().update(updates);
  await pruneHistory(db, config, telemetry.bagId);

  return { accepted: true, currentUpdated: isNewer };
}
