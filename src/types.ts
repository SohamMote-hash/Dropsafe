// Shared TypeScript types for DropSafe.

export type BagStatus = 'NORMAL' | 'LOW' | 'CRITICAL' | 'SENSOR_FAULT';
/** Alerts are only created for non-normal states. */
export type AlertType = Exclude<BagStatus, 'NORMAL'>;
export type PageId = 'overview' | 'live' | 'history' | 'settings';
/** Where readings come from: the demo simulator, USB serial, or the Firebase gateway. */
export type MonitorSource = 'SIMULATED' | 'HARDWARE' | 'FIREBASE';
export type DeviceLinkStatus = 'SIMULATED' | 'USB' | 'WAITING' | 'ONLINE' | 'STALE' | 'OFFLINE';

/** Live connection metadata for the Firebase Realtime Database transport. */
export interface CloudStatus {
  configured: boolean;
  /** True while the dashboard has active RTDB listeners. */
  subscribed: boolean;
  /** Firebase's own .info/connected socket state; reconnects automatically. */
  connected: boolean;
  deviceSeen: boolean;
  lastSeen: number | null;
  publishIntervalSec: number;
  firmware: string | null;
  rssi: number | null;
  error: string | null;
}

/** One raw measurement coming from a sensor source (demo today, HX711 later). */
export interface SensorReading {
  bagId: string;
  /** Wall-clock time of the reading (ms since epoch). */
  timestamp: number;
  /** Seconds of (simulated) elapsed time; used for flow-rate maths. */
  simSeconds: number;
  /** Measured gross weight in grams, or null when the sensor is faulty/disconnected. */
  weightG: number | null;
}

/** One processed point kept for the charts. */
export interface DataPoint {
  t: number;
  simS: number;
  volumeMl: number | null;
  weightG: number | null;
  flowMlH: number | null;
  /** True when the level was changed by hand/test control, so flow maths must restart here. */
  discontinuity?: boolean;
}

export interface Bag {
  id: string;
  name: string;
  initialVolumeMl: number;
  /** Last valid estimated volume (kept while the sensor is faulty). */
  volumeMl: number;
  weightG: number | null;
  status: BagStatus;
  /** Which status the user has acknowledged (null = nothing acknowledged). */
  ackedStatus: BagStatus | null;
  flowMlH: number | null;
  lastReadingAt: number;
  history: DataPoint[];
}

/** Hidden "physical" state of a simulated bag. Only the demo sensor uses this. */
export interface DemoSim {
  trueVolumeMl: number;
  targetFlowMlH: number;
  faultInjected: boolean;
  simSeconds: number;
}

export interface AlertEvent {
  id: string;
  timestamp: number;
  bagId: string;
  type: AlertType;
  volumeMl: number;
  acknowledged: boolean;
  acknowledgedAt: number | null;
  /** True for demo-generated alerts, false for live sensor alerts. */
  simulated: boolean;
}

export interface Settings {
  lowMl: number;
  criticalMl: number;
  intervalSec: number;
  soundEnabled: boolean;
  autoUpdates: boolean;
}

export interface Alarm {
  bagId: string;
  type: AlertType;
  volumeMl: number;
  acknowledged: boolean;
}
