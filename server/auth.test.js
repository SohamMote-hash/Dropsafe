import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashDeviceToken, verifyDeviceToken } from './auth.js';

const TOKEN = 'a'.repeat(64);
const DIGEST = createHash('sha256').update(TOKEN, 'utf8').digest('hex');

describe('hashDeviceToken', () => {
  it('returns a 32-byte SHA-256 digest', () => {
    const digest = hashDeviceToken(TOKEN);
    expect(Buffer.isBuffer(digest)).toBe(true);
    expect(digest).toHaveLength(32);
  });

  it('matches the hex stored in the environment', () => {
    expect(hashDeviceToken(TOKEN).toString('hex')).toBe(DIGEST);
  });
});

describe('verifyDeviceToken', () => {
  it('accepts the matching token', () => {
    expect(verifyDeviceToken(TOKEN, DIGEST)).toBe(true);
  });

  it('accepts an uppercase digest', () => {
    expect(verifyDeviceToken(TOKEN, DIGEST.toUpperCase())).toBe(true);
  });

  it('rejects a different token', () => {
    expect(verifyDeviceToken(`${TOKEN}x`, DIGEST)).toBe(false);
    expect(verifyDeviceToken('b'.repeat(64), DIGEST)).toBe(false);
  });

  it('rejects missing, empty and non-string tokens', () => {
    expect(verifyDeviceToken(undefined, DIGEST)).toBe(false);
    expect(verifyDeviceToken(null, DIGEST)).toBe(false);
    expect(verifyDeviceToken('', DIGEST)).toBe(false);
    expect(verifyDeviceToken(123, DIGEST)).toBe(false);
  });

  it('rejects a malformed expected digest', () => {
    expect(verifyDeviceToken(TOKEN, 'short')).toBe(false);
    expect(verifyDeviceToken(TOKEN, 'z'.repeat(64))).toBe(false);
    expect(verifyDeviceToken(TOKEN, '')).toBe(false);
    expect(verifyDeviceToken(TOKEN, undefined)).toBe(false);
  });
});
