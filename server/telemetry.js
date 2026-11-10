// Pure telemetry validation. No Firebase or Express imports here, so it is unit-testable.
const MAX_FUTURE_MS = 5 * 60 * 1000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const finite = (value) => typeof value === 'number' && Number.isFinite(value);

const cleanText = (value, maxLength) => {
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/[^A-Za-z0-9._:-]/g, '').slice(0, maxLength);
  return text || null;
};

/** Server-authoritative classification. Sensor validity is handled before this call. */
export function classifyVolume(volumeMl, lowMl, criticalMl) {
  if (!finite(volumeMl)) return 'SENSOR_FAULT';
  if (volumeMl <= criticalMl) return 'CRITICAL';
  if (volumeMl <= lowMl) return 'LOW';
  return 'NORMAL';
}

/**
 * Validates and normalizes an ESP32 payload against the gateway configuration.
 * The device-reported volume/percent are accepted only within safe limits, and the
 * status is always recalculated on the server so a faulty device cannot claim NORMAL.
 */
export function validateTelemetry(body, cfg) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Body must be a JSON object.' };
  }
  if (typeof body.deviceId !== 'string' || body.deviceId.trim() !== cfg.deviceId) {
    return { ok: false, error: 'Unknown device.' };
  }
  if (typeof body.bagId !== 'string' || body.bagId.trim() !== cfg.bagId) {
    return { ok: false, error: 'Unknown bag.' };
  }

  const sensorOk = body.sensorOk !== false;
  let weightG = body.weightG;
  if (weightG === null || weightG === undefined) weightG = null;
  else if (!finite(weightG) || weightG < 0 || weightG > cfg.maxLoadG) {
    return { ok: false, error: `weightG must be between 0 and ${cfg.maxLoadG}.` };
  }

  const sensorFault = !sensorOk || weightG === null;
  const maxVolume = cfg.initialVolumeMl * 1.25;
  let volumeMl = null;
  if (!sensorFault) {
    // Weight is the authoritative measurement; the device-reported volume is never trusted,
    // so a faulty or modified device cannot claim a healthy level.
    const computed = (weightG - cfg.emptyBagTareG) / cfg.densityGPerMl;
    volumeMl = clamp(round(computed, 1), 0, round(maxVolume, 1));
  }

  const percent = volumeMl === null ? 0 : clamp(round((volumeMl / cfg.initialVolumeMl) * 100, 1), 0, 100);
  const status = sensorFault
    ? 'SENSOR_FAULT'
    : classifyVolume(volumeMl, cfg.thresholds.lowMl, cfg.thresholds.criticalMl);

  const now = Date.now();
  let recordedAt = finite(body.recordedAt) ? Math.round(body.recordedAt) : now;
  if (recordedAt < now - MAX_AGE_MS || recordedAt > now + MAX_FUTURE_MS) recordedAt = now;

  const rssi = finite(body.rssi) && body.rssi >= -120 && body.rssi <= 0 ? Math.round(body.rssi) : null;
  const uptimeSec = finite(body.uptimeSec) && body.uptimeSec >= 0 && body.uptimeSec <= 1e9
    ? Math.round(body.uptimeSec)
    : null;
  const publishIntervalSec = finite(body.publishIntervalSec)
    && body.publishIntervalSec >= 1
    && body.publishIntervalSec <= 3600
    ? Math.round(body.publishIntervalSec)
    : 5;

  return {
    ok: true,
    value: {
      deviceId: cfg.deviceId,
      bagId: cfg.bagId,
      firmware: cleanText(body.firmware, 40),
      weightG: sensorFault ? null : round(weightG, 2),
      volumeMl,
      percent,
      status,
      sensorFault,
      alarm: body.alarm === true,
      rssi,
      uptimeSec,
      publishIntervalSec,
      recordedAt,
      receivedAt: now,
    },
  };
}
