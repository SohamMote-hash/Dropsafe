// One-off maintenance task: clears recorded history and current bag snapshots so the
// dashboard starts new. Keeps monitoring/config and monitoring/device, so the gateway
// and ESP32 continue working without a restart.
import { config } from './config.js';
import { initRealtimeDatabase } from './firebase.js';

const db = initRealtimeDatabase(config);

try {
  const historySnapshot = await db.ref('monitoring/history').get();
  const history = historySnapshot.val() ?? {};
  let points = 0;
  for (const entries of Object.values(history)) {
    points += Object.keys(entries ?? {}).length;
  }

  const bagsSnapshot = await db.ref('monitoring/bags').get();
  const bags = Object.keys(bagsSnapshot.val() ?? {}).length;

  await db.ref('monitoring/history').remove();
  await db.ref('monitoring/bags').remove();

  console.log(
    `Cleared ${points} history point(s) across ${Object.keys(history).length} channel(s) ` +
    `and ${bags} current bag snapshot(s).`,
  );
  console.log('Kept monitoring/config and monitoring/device.');
  process.exit(0);
} catch (error) {
  console.error('Reset failed:', error.message);
  process.exit(1);
}
