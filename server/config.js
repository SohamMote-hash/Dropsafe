// Server-only configuration. Loaded from .env; never expose these values to Vite.
import 'dotenv/config';

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable ${name}. See .env.example.`);
  return value;
};

const number = (name, fallback, { min = -Infinity, max = Infinity } = {}) => {
  const raw = process.env[name]?.trim();
  const value = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be a number between ${min} and ${max}.`);
  }
  return value;
};

const boolean = (name, fallback) => {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw);
};

const databaseUrl = required('FIREBASE_DATABASE_URL');
const deviceTokenSha256 = required('DEVICE_TOKEN_SHA256').toLowerCase();
if (!/^[a-f0-9]{64}$/.test(deviceTokenSha256)) {
  throw new Error('DEVICE_TOKEN_SHA256 must be a 64-character SHA-256 hex digest. Run: npm run device-token');
}

const lowMl = number('LOW_ML', 100, { min: 0, max: 5000 });
const criticalMl = number('CRITICAL_ML', 25, { min: 0, max: 5000 });
if (criticalMl >= lowMl) throw new Error('CRITICAL_ML must be lower than LOW_ML.');

const initialVolumeMl = number('INITIAL_VOLUME_ML', 500, { min: 1, max: 10000 });
const densityGPerMl = number('FLUID_DENSITY_G_PER_ML', 1.005, { min: 0.1, max: 10 });

export const config = {
  port: number('PORT', 8787, { min: 1, max: 65535 }),
  databaseUrl,
  serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim() || '',
  serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() || '',
  deviceId: required('DEVICE_ID'),
  deviceTokenSha256,
  bagId: process.env.BAG_ID?.trim() || 'IV-01',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  thresholds: { lowMl, criticalMl },
  initialVolumeMl,
  emptyBagTareG: number('EMPTY_BAG_TARE_G', 30, { min: 0, max: 5000 }),
  densityGPerMl,
  maxLoadG: number('MAX_LOAD_G', 5000, { min: 1, max: 100000 }),
  minWriteIntervalMs: number('MIN_WRITE_INTERVAL_MS', 1000, { min: 0, max: 600000 }),
  maxHistoryPoints: number('MAX_HISTORY_POINTS', 500, { min: 10, max: 100000 }),
  requireHttps: boolean('REQUIRE_HTTPS', false),
};
