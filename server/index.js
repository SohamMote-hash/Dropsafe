// Secure write gateway: ESP32 -> HTTPS POST -> Firebase Admin SDK -> Realtime Database.
// Browsers never receive the Admin credentials or the device token.
import { pathToFileURL } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { verifyDeviceToken } from './auth.js';
import { validateTelemetry } from './telemetry.js';
import { initRealtimeDatabase, publishConfig, writeTelemetry } from './firebase.js';

const db = initRealtimeDatabase(config);
export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || config.allowedOrigins.includes(origin)),
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Device-Token'],
}));
app.use(express.json({ limit: '16kb' }));

if (config.requireHttps) {
  app.use((req, res, next) => {
    if (req.secure) return next();
    return res.status(403).json({ ok: false, error: 'HTTPS is required.' });
  });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'dropsafe-gateway' });
});

let lastWriteAt = 0;

app.post('/api/telemetry', async (req, res) => {
  if (!verifyDeviceToken(req.get('x-device-token'), config.deviceTokenSha256)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized.' });
  }

  const now = Date.now();
  if (now - lastWriteAt < config.minWriteIntervalMs) {
    const retryAfter = Math.max(1, Math.ceil((config.minWriteIntervalMs - (now - lastWriteAt)) / 1000));
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ ok: false, error: 'Too many requests.' });
  }
  lastWriteAt = now;

  const result = validateTelemetry(req.body, config);
  if (!result.ok) {
    return res.status(400).json({ ok: false, error: result.error });
  }

  try {
    const outcome = await writeTelemetry(db, config, result.value);
    console.log(
      `[telemetry] ${result.value.bagId} ${result.value.status} ` +
      `${result.value.volumeMl ?? 'n/a'} mL current=${outcome.currentUpdated}`,
    );
    return res.status(202).json({
      ok: true,
      recordedAt: result.value.recordedAt,
      status: result.value.status,
      currentUpdated: outcome.currentUpdated,
    });
  } catch (error) {
    console.error('[telemetry] write failed:', error.message);
    return res.status(503).json({ ok: false, error: 'Storage unavailable.' });
  }
});

app.use((_req, res) => res.status(404).json({ ok: false, error: 'Not found.' }));

app.use((error, _req, res, _next) => {
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ ok: false, error: 'Payload too large.' });
  }
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ ok: false, error: 'Invalid JSON.' });
  }
  console.error('[server] unexpected error:', error);
  return res.status(500).json({ ok: false, error: 'Internal error.' });
});

let configPublished = null;

/** Publishes the effective limits once per process; warm serverless instances reuse the result. */
export function ensureConfigPublished() {
  configPublished ??= publishConfig(db, config).catch((error) => {
    configPublished = null;
    throw error;
  });
  return configPublished;
}

async function start() {
  try {
    await ensureConfigPublished();
    app.listen(config.port, () => {
      console.log(`DropSafe write gateway listening on port ${config.port}`);
      console.log(`Accepting telemetry for device "${config.deviceId}", bag "${config.bagId}".`);
    });
  } catch (error) {
    console.error('Unable to initialize Firebase Admin:', error.message);
    console.error('Check FIREBASE_SERVICE_ACCOUNT_PATH / FIREBASE_DATABASE_URL and the database rules.');
    process.exitCode = 1;
  }
}

// `node server/index.js` starts a listener; imports from api/ just reuse the app.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  start();
}
