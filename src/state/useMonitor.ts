import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Alarm, AlertType, CloudStatus, SensorReading, Settings } from '../types';
import { createInitialState, monitorReducer, MANUAL_REDUCE_ML } from './monitor';
import { loadAlerts, loadBagConfigs, loadSettings, saveAlerts, saveBagConfigs, saveSettings } from '../lib/storage';
import { deriveAlarms, MAX_HISTORY_POINTS } from '../lib/processing';
import { SEVERITY } from '../lib/status';
import { ALARM_PERIOD_MS, playAlarm } from '../lib/sound';
import {
  FIREBASE_AUTO_CONNECT, FIREBASE_BAG_ID, FIREBASE_DEVICE_ID,
  firebaseConfigured, getFirebaseDatabase,
} from '../lib/firebase';
import {
  loadHistory, subscribeToBag, subscribeToConnection, subscribeToDevice, toDataPoint,
} from '../data/firebaseProvider';

/** Repeats the alarm tone for the most urgent UNacknowledged alarm while sound is enabled. */
function useAlarmSound(alarms: Alarm[], enabled: boolean) {
  let top: AlertType | null = null;
  for (const a of alarms) {
    if (a.acknowledged) continue;
    if (top === null || SEVERITY[a.type] > SEVERITY[top]) top = a.type;
  }
  useEffect(() => {
    if (!enabled || top === null) return;
    playAlarm(top);
    const id = window.setInterval(() => playAlarm(top as AlertType), ALARM_PERIOD_MS[top]);
    return () => window.clearInterval(id);
  }, [enabled, top]);
}

const createCloudStatus = (): CloudStatus => ({
  configured: firebaseConfigured,
  subscribed: false,
  connected: false,
  deviceSeen: false,
  lastSeen: null,
  publishIntervalSec: 5,
  firmware: null,
  rssi: null,
  error: null,
});

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

type Transport = 'SIMULATED' | 'SERIAL' | 'CLOUD';

export function useMonitor() {
  const [state, dispatch] = useReducer(monitorReducer, undefined, () =>
    createInitialState(loadSettings(), loadAlerts(), Date.now(), loadBagConfigs()));
  const [hardwareConnected, setHardwareConnected] = useState(false);
  const [cloud, setCloud] = useState<CloudStatus>(createCloudStatus);
  const serialPortRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const transportRef = useRef<Transport>('SIMULATED');
  const cloudStopRef = useRef<(() => void) | null>(null);
  const cloudGenerationRef = useRef(0);

  // Persist settings and alert history.
  useEffect(() => saveSettings(state.settings), [state.settings]);
  useEffect(() => saveAlerts(state.alerts), [state.alerts]);
  useEffect(() => saveBagConfigs(state.bagConfigs), [state.bagConfigs]);

  // The simulation clock. Cleared whenever the demo is paused or auto updates are off.
  const { intervalSec, autoUpdates } = state.settings;
  useEffect(() => {
    if (!state.running || !autoUpdates || state.source !== 'SIMULATED') return;
    const id = window.setInterval(() => dispatch({ type: 'TICK', now: Date.now() }), intervalSec * 1000);
    return () => window.clearInterval(id);
  }, [state.running, autoUpdates, intervalSec, state.source]);

  const alarms = useMemo(() => deriveAlarms(state.bags), [state.bags]);
  useAlarmSound(alarms, state.settings.soundEnabled);

  /** Stops RTDB listeners and returns the app to simulation mode. Does not touch the reducer. */
  const stopCloudSubscription = useCallback(() => {
    cloudGenerationRef.current += 1;
    const stop = cloudStopRef.current;
    cloudStopRef.current = null;
    if (stop) stop();
    if (transportRef.current === 'CLOUD') transportRef.current = 'SIMULATED';
    setCloud(createCloudStatus());
  }, []);

  const disconnectHardware = useCallback(async () => {
    if (transportRef.current === 'SERIAL') transportRef.current = 'SIMULATED';
    try { await readerRef.current?.cancel(); } catch { /* reader may already be closed */ }
    try { readerRef.current?.releaseLock(); } catch { /* ignore */ }
    try { await serialPortRef.current?.close(); } catch { /* port may already be closed */ }
    readerRef.current = null;
    serialPortRef.current = null;
    setHardwareConnected(false);
    dispatch({ type: 'SET_SOURCE', source: 'SIMULATED' });
  }, []);

  const connectHardware = useCallback(async () => {
    const serial = (navigator as any).serial;
    if (!serial) throw new Error('Web Serial is unavailable. Use Chrome or Edge on localhost.');
    const port = await serial.requestPort();
    await port.open({ baudRate: 115200 });
    if (!port.readable) {
      try { await port.close(); } catch { /* port may already be closed */ }
      throw new Error('The serial port did not provide a readable stream.');
    }

    let reader;
    try {
      reader = port.readable.getReader();
    } catch (error) {
      try { await port.close(); } catch { /* port may already be closed */ }
      throw error;
    }

    // Only leave the cloud transport once the USB port is definitely open.
    stopCloudSubscription();
    transportRef.current = 'SERIAL';
    serialPortRef.current = port;
    readerRef.current = reader;
    setHardwareConnected(true);
    dispatch({ type: 'SET_SOURCE', source: 'HARDWARE' });

    const decoder = new TextDecoder();
    let pending = '';

    // Resolve the click handler as soon as the port is open; this loop runs until unplug/disconnect.
    void (async () => {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          pending += decoder.decode(value, { stream: true });
          const lines = pending.split(/\r?\n/);
          pending = lines.pop() ?? '';
          for (const line of lines) {
            try {
              const raw = JSON.parse(line);
              if (typeof raw.bagId !== 'string' || !(raw.weightG === null || Number.isFinite(raw.weightG))) continue;
              const reading: SensorReading = {
                bagId: raw.bagId,
                timestamp: Date.now(),
                simSeconds: Number.isFinite(raw.simSeconds) ? raw.simSeconds : Date.now() / 1000,
                weightG: raw.weightG,
              };
              dispatch({ type: 'SENSOR_READING', reading });
            } catch { /* ignore firmware startup/status lines and malformed data */ }
          }
        }
      } catch {
        /* device unplugged or the stream was cancelled */
      } finally {
        try { reader.releaseLock(); } catch { /* ignore */ }
        try { await port.close(); } catch { /* ignore */ }
        readerRef.current = null;
        serialPortRef.current = null;
        if (transportRef.current === 'SERIAL') {
          transportRef.current = 'SIMULATED';
          setHardwareConnected(false);
          dispatch({ type: 'SET_SOURCE', source: 'SIMULATED' });
        }
      }
    })();
  }, [stopCloudSubscription]);

  /** Subscribes to the public RTDB monitoring path. Firebase reconnects automatically. */
  const connectCloud = useCallback(() => {
    if (!firebaseConfigured) {
      setCloud((prev) => ({
        ...prev,
        error: 'Firebase is not configured. Set VITE_FIREBASE_DATABASE_URL in .env.',
      }));
      return;
    }
    if (cloudStopRef.current) return;

    const generation = ++cloudGenerationRef.current;
    const setup = async () => {
      await disconnectHardware(); // USB serial and cloud live are mutually exclusive
      if (cloudGenerationRef.current !== generation) return;

      transportRef.current = 'CLOUD';
      const unsubscribers: Array<() => void> = [];
      cloudStopRef.current = () => {
        for (const unsubscribe of unsubscribers) {
          try { unsubscribe(); } catch { /* listener may already be detached */ }
        }
      };
      const isActive = () => cloudGenerationRef.current === generation && cloudStopRef.current !== null;
      setCloud((prev) => ({ ...prev, subscribed: true, connected: false, error: null }));

      try {
        const db = getFirebaseDatabase();
        let switched = false;
        const switchToLive = () => {
          if (!isActive() || switched) return;
          switched = true;
          dispatch({ type: 'SET_SOURCE', source: 'FIREBASE', liveBagId: FIREBASE_BAG_ID });
        };

        unsubscribers.push(subscribeToConnection(db, (connected) => {
          if (isActive()) setCloud((prev) => ({ ...prev, connected }));
        }, (error) => {
          if (isActive()) setCloud((prev) => ({ ...prev, error: errorMessage(error) }));
        }));

        unsubscribers.push(subscribeToDevice(db, FIREBASE_DEVICE_ID, (device) => {
          if (!isActive()) return;
          setCloud((prev) => ({
            ...prev,
            deviceSeen: true,
            lastSeen: device.lastSeen ?? prev.lastSeen,
            publishIntervalSec: device.publishIntervalSec ?? prev.publishIntervalSec,
            firmware: device.firmware,
            rssi: device.rssi,
            error: null,
          }));
        }, (error) => {
          if (isActive()) setCloud((prev) => ({ ...prev, error: errorMessage(error) }));
        }));

        unsubscribers.push(subscribeToBag(db, FIREBASE_BAG_ID, (bag) => {
          if (!isActive()) return;
          const timestamp = bag.recordedAt ?? bag.updatedAt ?? Date.now();
          switchToLive();
          const reading: SensorReading = {
            bagId: FIREBASE_BAG_ID,
            timestamp,
            simSeconds: timestamp / 1000,
            weightG: bag.sensorOk ? bag.weightG : null,
          };
          dispatch({ type: 'SENSOR_READING', reading });
          setCloud((prev) => ({
            ...prev,
            deviceSeen: true,
            lastSeen: prev.lastSeen ?? bag.updatedAt,
            error: null,
          }));
        }, (error) => {
          if (isActive()) setCloud((prev) => ({ ...prev, error: errorMessage(error) }));
        }));

        void loadHistory(db, FIREBASE_BAG_ID, MAX_HISTORY_POINTS)
          .then((points) => {
            if (!isActive() || points.length === 0) return;
            dispatch({
              type: 'HYDRATE_HISTORY',
              bagId: FIREBASE_BAG_ID,
              points: points.map(toDataPoint),
            });
          })
          .catch((error) => {
            if (isActive()) {
              setCloud((prev) => ({ ...prev, error: `History: ${errorMessage(error)}` }));
            }
          });
      } catch (error) {
        if (isActive()) {
          setCloud((prev) => ({
            ...prev, subscribed: false, connected: false, error: errorMessage(error),
          }));
        }
        const stop = cloudStopRef.current;
        cloudStopRef.current = null;
        if (stop) stop();
        if (transportRef.current === 'CLOUD') transportRef.current = 'SIMULATED';
      }
    };

    void setup();
  }, [disconnectHardware]);

  const disconnectCloud = useCallback(() => {
    stopCloudSubscription();
    dispatch({ type: 'SET_SOURCE', source: 'SIMULATED' });
  }, [stopCloudSubscription]);

  // Auto-subscribe when Firebase is configured. The SDK retries dropped connections itself.
  useEffect(() => {
    if (!firebaseConfigured || !FIREBASE_AUTO_CONNECT) return;
    connectCloud();
    return () => stopCloudSubscription();
  }, [connectCloud, stopCloudSubscription]);

  const actions = useMemo(() => ({
    setRunning: (running: boolean) => dispatch({ type: 'SET_RUNNING', running }),
    selectBag: (bagId: string) => dispatch({ type: 'SELECT_BAG', bagId }),
    addBag: (bag: { name: string; initialVolumeMl: number; startVolumeMl: number; flowMlH: number }) =>
      dispatch({ type: 'ADD_BAG', ...bag, now: Date.now() }),
    resetBag: (bagId: string) => dispatch({ type: 'RESET_BAG', bagId, now: Date.now() }),
    reduceBag: (bagId: string, amountMl = MANUAL_REDUCE_ML) =>
      dispatch({ type: 'MANUAL_REDUCE', bagId, amountMl, now: Date.now() }),
    simulateLevel: (bagId: string, level: 'LOW' | 'CRITICAL') =>
      dispatch({ type: 'SIM_LEVEL', bagId, level, now: Date.now() }),
    simulateFault: (bagId: string) => dispatch({ type: 'SIM_FAULT', bagId, now: Date.now() }),
    restoreNormal: (bagId: string) => dispatch({ type: 'RESTORE_NORMAL', bagId, now: Date.now() }),
    acknowledgeBag: (bagId: string) => dispatch({ type: 'ACK_BAG', bagId, now: Date.now() }),
    acknowledgeAlert: (id: string) => dispatch({ type: 'ACK_ALERT', id, now: Date.now() }),
    clearAlerts: () => dispatch({ type: 'CLEAR_ALERTS' }),
    updateSettings: (settings: Settings) => dispatch({ type: 'UPDATE_SETTINGS', settings, now: Date.now() }),
    connectHardware,
    disconnectHardware,
    connectCloud,
    disconnectCloud,
  }), [connectHardware, disconnectHardware, connectCloud, disconnectCloud]);

  return { state, alarms, actions, hardwareConnected, cloud };
}

export type MonitorApi = ReturnType<typeof useMonitor>;
