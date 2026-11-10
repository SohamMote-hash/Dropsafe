import { createHash, timingSafeEqual } from 'node:crypto';

/** SHA-256 of the raw device token. Only this digest is stored in the gateway env. */
export const hashDeviceToken = (token) => createHash('sha256').update(token, 'utf8').digest();

/**
 * Constant-time comparison of a presented token against the configured digest.
 * Returns false for missing/empty/non-string headers.
 */
export function verifyDeviceToken(presented, expectedHex) {
  if (typeof presented !== 'string' || presented.length === 0) return false;
  if (typeof expectedHex !== 'string' || !/^[a-f0-9]{64}$/i.test(expectedHex)) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = hashDeviceToken(presented);
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
