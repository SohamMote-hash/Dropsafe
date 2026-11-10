import type { PageId } from '../types';

export const PAGE_IDS: PageId[] = ['overview', 'live', 'history', 'settings'];

export type RouteId = PageId | 'not-found';

export interface PageMeta {
  title: string;
  description: string;
}

export const PAGE_META: Record<PageId, PageMeta> = {
  overview: {
    title: 'Overview · DropSafe IV Bag Monitoring',
    description:
      'See every IV bag channel at a glance: remaining fluid, flow rate, status and active alerts in the DropSafe dashboard.',
  },
  live: {
    title: 'Live Monitoring · DropSafe',
    description:
      'Track the selected IV bag in real time, including remaining volume, flow rate, time to empty and low or critical alerts.',
  },
  history: {
    title: 'Alert History · DropSafe',
    description:
      'Review, filter, acknowledge and export DropSafe alerts for low fluid, critical levels and sensor faults.',
  },
  settings: {
    title: 'Settings · DropSafe',
    description:
      'Configure DropSafe low and critical thresholds, the demo update interval, alarm sound and automatic updates.',
  },
};

export const NOT_FOUND_META: PageMeta = {
  title: 'Page Not Found · DropSafe',
  description: 'The page you requested could not be found. Return to the DropSafe monitoring dashboard.',
};

export function metaFor(route: RouteId): PageMeta {
  return route === 'not-found' ? NOT_FOUND_META : PAGE_META[route];
}

/** Accepts both `#live` and `#/live`; anything unrecognised becomes the 404 route. */
export function routeFromHash(hash: string): RouteId {
  const id = hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  if (!id) return 'overview';
  return (PAGE_IDS as string[]).includes(id) ? (id as PageId) : 'not-found';
}
