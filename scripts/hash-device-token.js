// Generates a device token (or hashes one you supply for the gateway .env).
// Usage:
//   npm run device-token                 -> new random token + its hash
//   npm run device-token -- "<token>"    -> hash an existing token
import { createHash, randomBytes } from 'node:crypto';

const supplied = process.argv[2];
const token = supplied?.trim() || randomBytes(32).toString('hex');

if (token.length < 32) {
  console.error('Device token must be at least 32 characters. Use: npm run device-token');
  process.exit(1);
}

const hash = createHash('sha256').update(token, 'utf8').digest('hex');

console.log('Device token (put this only in esp32_dropsafe/secrets.h):');
console.log(token);
console.log('');
console.log('DEVICE_TOKEN_SHA256 (put this in .env, never commit .env):');
console.log(hash);
