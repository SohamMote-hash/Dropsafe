import { describe, expect, it } from 'vitest';
import { readingFreshness } from './format';

describe('readingFreshness', () => {
  it('uses the configured interval and allows two missed polling windows', () => {
    expect(readingFreshness(60, 30, true)).toBe('fresh');
    expect(readingFreshness(61, 30, true)).toBe('stale');
  });

  it('does not flag an intentionally paused monitor as stale', () => {
    expect(readingFreshness(300, 2, false)).toBe('paused');
  });

  it('flags missed updates while monitoring is active', () => {
    expect(readingFreshness(5, 2, true)).toBe('stale');
  });
});
