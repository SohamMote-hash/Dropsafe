import { useEffect, useState } from 'react';
import { Activity, CloudOff, WifiOff } from 'lucide-react';
import { FlowRateChart, VolumeTrendChart } from '../components/Charts';
import { EmptyState } from '../components/EmptyState';
import { ControlPanel } from '../components/ControlPanel';
import { CountUp } from '../components/CountUp';
import { FluidLevelIndicator } from '../components/FluidLevelIndicator';
import { DemoTag, LiveTag, StatusBadge } from '../components/StatusBadge';
import { Tile } from '../components/Tile';
import type { TileUrgency } from '../components/Tile';
import { remainingPercent, timeToEmptyHours } from '../lib/calculations';
import { deviceLinkStatus, DEVICE_LINK_LABEL } from '../lib/cloud';
import { CLOUD_STALE_AFTER_SEC, FIREBASE_DEVICE_ID } from '../lib/firebase';
import { formatDateTime, formatDuration, formatFlow, formatMl, formatTime, readingFreshness } from '../lib/format';
import { STATUS_META } from '../lib/status';
import { useMonitorContext } from '../state/MonitorContext';

/** Returns urgency level for time-to-empty display. */
function tteUrgency(tte: number | null): TileUrgency {
  if (tte === null) return 'normal';
  const minutes = tte * 60;
  if (minutes < 5) return 'critical';
  if (minutes < 15) return 'warning';
  return 'normal';
}

function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/** Shows how many seconds ago the last reading arrived. Refreshes every second. */
function FreshnessIndicator({ lastReadingAt, intervalSec, active }: {
  lastReadingAt: number; intervalSec: number; active: boolean;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const sec = Math.floor((now - lastReadingAt) / 1000);
  const freshness = readingFreshness(sec, intervalSec, active);
  const label = freshness === 'paused' ? `updates paused · ${sec}s ago` : sec <= 1 ? 'just now' : `${sec}s ago`;
  return (
    <span className={`text-xs font-medium ${freshness === 'stale' ? 'text-amber-600' : 'text-slate-500'}`}>
      {freshness === 'paused' ? 'Last reading' : 'Last updated'}: {label}
    </span>
  );
}

export function LiveMonitoring() {
  const { state, alarms, actions, cloud } = useMonitorContext();
  const { bags, settings, selectedBagId, running } = state;
  const bag = bags.find((b) => b.id === selectedBagId) ?? bags[0];
  const now = useNow();

  if (!bag) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-navy-900">Live Monitoring</h1>
        <EmptyState
          icon={Activity}
          title="No IV channel available"
          description="There is no channel to monitor yet. Check the source configuration or reload the dashboard."
        />
      </div>
    );
  }

  const fault = bag.status === 'SENSOR_FAULT';
  const pct = remainingPercent(bag.volumeMl, bag.initialVolumeMl);
  const tte = fault ? null : timeToEmptyHours(bag.volumeMl, bag.flowMlH);
  const alarm = alarms.find((a) => a.bagId === bag.id);
  const live = state.source !== 'SIMULATED';
  const link = deviceLinkStatus(state.source, cloud, now, CLOUD_STALE_AFTER_SEC);
  const linkUrgency: TileUrgency = link === 'OFFLINE'
    ? 'critical'
    : link === 'STALE' || link === 'WAITING' ? 'warning' : 'normal';
  const deviceSub = state.source === 'FIREBASE'
    ? (cloud.lastSeen ? `last updated ${formatTime(cloud.lastSeen)}` : 'waiting for telemetry')
    : state.source === 'HARDWARE' ? `last reading ${formatTime(bag.lastReadingAt)}` : 'simulated source';
  const connectionIssue = state.source === 'FIREBASE'
    && (link === 'STALE' || link === 'OFFLINE' || link === 'WAITING');
  const freshnessInterval = state.source === 'FIREBASE' ? cloud.publishIntervalSec : settings.intervalSec;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-navy-900">Live Monitoring</h1>
        {live ? <LiveTag /> : <DemoTag />}
        <span className="text-xs text-slate-500">
          {state.source === 'FIREBASE'
            ? `Wireless · Firebase RTDB · ${cloud.subscribed
              ? (cloud.connected ? 'subscribed' : 'reconnecting') : 'disconnected'}`
            : state.source === 'HARDWARE'
              ? 'Live USB serial readings · 115200 baud'
              : `Simulation ${running ? 'running' : 'paused'} · update every ${settings.intervalSec} s`}
        </span>
      </div>

      {connectionIssue && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          <WifiOff className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">
              {link === 'OFFLINE'
                ? 'Firebase connection lost — showing the last known values.'
                : link === 'WAITING'
                  ? 'Connected to Firebase — waiting for the first ESP32 reading.'
                  : 'ESP32 telemetry is stale — showing the last known values.'}
            </p>
            <p className="mt-0.5 text-xs">
              The ESP32 keeps monitoring and alarming locally while the network is down, and will resume
              synchronization automatically after reconnecting.
              {cloud.lastSeen && ` Last update: ${formatDateTime(cloud.lastSeen)}.`}
            </p>
          </div>
        </div>
      )}

      {cloud.error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          <CloudOff className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p><strong>Cloud sync warning:</strong> {cloud.error}</p>
        </div>
      )}

      {/* Bag selector tabs — now include % remaining */}
      <div role="tablist" aria-label="Select IV bag" className="flex flex-wrap gap-2">
        {bags.map((b) => {
          const active = b.id === bag.id;
          const bagPct = remainingPercent(b.volumeMl, b.initialVolumeMl);
          return (
            <button
              key={b.id}
              role="tab"
              aria-selected={active}
              onClick={() => actions.selectBag(b.id)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition active:scale-[0.98] ${
                active
                  ? 'border-navy-900 bg-navy-900 text-white shadow-[0_10px_24px_-16px_rgba(11,31,58,0.9)]'
                  : 'border-slate-300 bg-white text-navy-900 hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_META[b.status].hex }} />
              {b.id}
              <span className={`text-[11px] font-normal tabular-nums ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                {b.status === 'SENSOR_FAULT' ? '?' : `${bagPct.toFixed(0)}%`}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="ds-card flex flex-col items-center p-5">
          <div className="mb-3 flex w-full items-center justify-between">
            <h2 className="font-bold text-navy-900">{bag.id}</h2>
            <StatusBadge status={bag.status} large />
          </div>
          <FluidLevelIndicator
            size="lg"
            percent={pct}
            status={bag.status}
            lowPercent={remainingPercent(settings.lowMl, bag.initialVolumeMl)}
            criticalPercent={remainingPercent(settings.criticalMl, bag.initialVolumeMl)}
          />
          <p className="mt-2 text-xs text-slate-500">
            {bag.name} · {bag.initialVolumeMl} mL bag · dashed lines = thresholds
          </p>
          {fault && (
            <p
              className="mt-3 rounded-lg bg-violet-50 p-2 text-center text-xs font-medium text-violet-800"
              role="alert"
            >
              Sensor data is invalid or disconnected. Volume, flow and time to empty are unreliable.
            </p>
          )}
          {alarm && alarm.acknowledged && (
            <p className="mt-3 text-center text-xs font-medium text-slate-600">
              Alert acknowledged — status is still {STATUS_META[bag.status].label}.
            </p>
          )}
        </section>

        <section className="space-y-5 lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Tile
              label="Remaining volume"
              value={fault ? 'Unreliable' : <><CountUp value={bag.volumeMl} /> mL</>}
              sub={fault ? `last valid ${formatMl(bag.volumeMl)}` : undefined}
            />
            <Tile label="Remaining" value={fault ? '—' : <><CountUp value={pct} /> %</>} />
            <Tile
              label={`Weight${live ? '' : ' (simulated)'}`}
              value={bag.weightG !== null && Number.isFinite(bag.weightG)
                ? <><CountUp value={bag.weightG} decimals={1} /> g</>
                : '—'}
              sub="load-cell value"
            />
            <Tile label="Flow rate" value={fault ? 'Unavailable' : formatFlow(bag.flowMlH)} />
            <Tile
              label="Time to empty"
              value={formatDuration(tte)}
              urgency={tteUrgency(tte)}
              sub={tteUrgency(tte) !== 'normal' ? (tteUrgency(tte) === 'critical' ? '⚠ Under 5 min' : '⚠ Under 15 min') : undefined}
            />
            <Tile
              label="Monitoring state"
              value={STATUS_META[bag.status].label}
              sub={`last reading ${formatTime(bag.lastReadingAt)}`}
            />
            <Tile
              label="Device status"
              value={DEVICE_LINK_LABEL[link]}
              urgency={linkUrgency}
              sub={deviceSub}
            />
          </div>
          {state.source === 'FIREBASE' && (
            <p className="text-xs text-slate-500">
              Device <span className="font-mono">{FIREBASE_DEVICE_ID}</span>
              {' · '}Firmware {cloud.firmware ?? '—'}
              {' · '}Wi-Fi RSSI {cloud.rssi !== null ? `${cloud.rssi} dBm` : '—'}
              {' · '}Firebase {cloud.connected ? 'connected' : 'reconnecting'}
            </p>
          )}
          <div className="flex items-center justify-end">
            <FreshnessIndicator lastReadingAt={bag.lastReadingAt} intervalSec={freshnessInterval}
              active={state.source === 'SIMULATED' ? running && settings.autoUpdates : true} />
          </div>
          {state.source === 'SIMULATED' && <ControlPanel
            bag={bag}
            settings={settings}
            running={running}
            actions={actions}
            needsAck={!!alarm && !alarm.acknowledged}
          />}
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <VolumeTrendChart bag={bag} settings={settings} live={live} />
        <FlowRateChart bag={bag} live={live} />
      </div>
    </div>
  );
}
