// Shared Vercel handler: both api/ routes hand requests to the Express gateway.
import { app, ensureConfigPublished } from './index.js';

export default async function handler(req, res) {
  try {
    await ensureConfigPublished();
  } catch (error) {
    // Telemetry writes can still succeed even if the metadata node cannot be updated.
    console.error('[gateway] config publish failed:', error.message);
  }
  return app(req, res);
}
