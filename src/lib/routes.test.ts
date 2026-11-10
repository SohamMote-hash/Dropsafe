import { describe, expect, it } from 'vitest';
import { metaFor, PAGE_META, routeFromHash } from './routes';

describe('routeFromHash', () => {
  it('maps every known page hash', () => {
    expect(routeFromHash('#overview')).toBe('overview');
    expect(routeFromHash('#live')).toBe('live');
    expect(routeFromHash('#history')).toBe('history');
    expect(routeFromHash('#settings')).toBe('settings');
  });

  it('accepts a leading slash', () => {
    expect(routeFromHash('#/live')).toBe('live');
  });

  it('treats an empty hash as the overview', () => {
    expect(routeFromHash('')).toBe('overview');
    expect(routeFromHash('#')).toBe('overview');
    expect(routeFromHash('#/')).toBe('overview');
  });

  it('sends unknown paths to the 404 route', () => {
    expect(routeFromHash('#about')).toBe('not-found');
    expect(routeFromHash('#does-not-exist')).toBe('not-found');
    expect(routeFromHash('#live/extra')).toBe('live');
  });
});

describe('metaFor', () => {
  it('provides a unique title and description for every page', () => {
    const titles = Object.values(PAGE_META).map((meta) => meta.title);
    const descriptions = Object.values(PAGE_META).map((meta) => meta.description);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
    for (const description of descriptions) expect(description.length).toBeGreaterThan(50);
  });

  it('uses the not-found metadata for the 404 route', () => {
    expect(metaFor('not-found').title).toContain('Not Found');
    expect(metaFor('overview').title).toBe(PAGE_META.overview.title);
  });
});
