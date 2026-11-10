// localStorage persistence for settings, alert history and added bag channels. Every access is
// wrapped in try/catch because storage can be blocked (private mode) or contain corrupted data.
import type { AlertEvent, Settings } from '../types';
import { LIVE_BAG_CONFIG, type BagConfig } from '../data/sensorProvider';
import { DEFAULT_SETTINGS, isValidSettings } from './settings';

const SETTINGS_KEY = 'dropsafe.settings.v1';
const ALERTS_KEY = 'dropsafe.alerts.v2';
const LEGACY_ALERTS_KEY = 'dropsafe.alerts.v1';
const BAGS_KEY = 'dropsafe.bags.v1';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    return isValidSettings(parsed) ? (parsed as Settings) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch { /* ignore */ }
}

const isAlert = (a: unknown): a is AlertEvent => {
  const x = a as AlertEvent;
  return (
    !!x && typeof x.id === 'string' && typeof x.bagId === 'string' && typeof x.timestamp === 'number' &&
    ['LOW', 'CRITICAL', 'SENSOR_FAULT'].includes(x.type) && typeof x.acknowledged === 'boolean'
  );
};

export function loadAlerts(): AlertEvent[] {
  try {
    // History from the old four-demo-channel dashboard is intentionally discarded.
    if (localStorage.getItem(LEGACY_ALERTS_KEY) !== null) {
      localStorage.removeItem(LEGACY_ALERTS_KEY);
    }
    const raw = localStorage.getItem(ALERTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isAlert) : [];
  } catch {
    return [];
  }
}

export function saveAlerts(alerts: AlertEvent[]) {
  try {
    localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
  } catch { /* ignore */ }
}

const isBagConfig = (config: unknown): config is BagConfig => {
  const c = config as BagConfig;
  return (
    !!c && typeof c.id === 'string' && /^IV-\d{2,}$/.test(c.id) &&
    typeof c.name === 'string' && c.name.trim().length > 0 &&
    Number.isFinite(c.initialVolumeMl) && c.initialVolumeMl > 0 &&
    Number.isFinite(c.startVolumeMl) && c.startVolumeMl >= 0 && c.startVolumeMl <= c.initialVolumeMl &&
    Number.isFinite(c.flowMlH) && c.flowMlH >= 0
  );
};

/** Added channels only; the live IV-01 bag is always built in. */
export function loadBagConfigs(): BagConfig[] {
  try {
    const raw = localStorage.getItem(BAGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const byId = new Map<string, BagConfig>();
    for (const config of parsed) {
      if (isBagConfig(config) && config.id !== LIVE_BAG_CONFIG.id) byId.set(config.id, config);
    }
    return [...byId.values()];
  } catch {
    return [];
  }
}

export function saveBagConfigs(configs: BagConfig[]) {
  try {
    const added = configs.filter((config) => config.id !== LIVE_BAG_CONFIG.id && isBagConfig(config));
    localStorage.setItem(BAGS_KEY, JSON.stringify(added));
  } catch { /* ignore */ }
}
