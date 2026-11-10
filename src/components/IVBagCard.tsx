import { ArrowRight } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import type { Bag, Settings } from '../types';
import { remainingPercent, timeToEmptyHours } from '../lib/calculations';
import { formatDuration, formatFlow, formatTime } from '../lib/format';
import { STATUS_META } from '../lib/status';
import { CountUp } from './CountUp';
import { FluidLevelIndicator } from './FluidLevelIndicator';
import { DemoTag, LiveTag, StatusBadge } from './StatusBadge';

export function IVBagCard({ bag, settings, live = false, index = 0, onOpen }: {
  bag: Bag; settings: Settings; live?: boolean; index?: number; onOpen: () => void;
}) {
  const pct = remainingPercent(bag.volumeMl, bag.initialVolumeMl);
  const fault = bag.status === 'SENSOR_FAULT';
  const tte = fault ? null : timeToEmptyHours(bag.volumeMl, bag.flowMlH);
  const lowPct = remainingPercent(settings.lowMl, bag.initialVolumeMl);
  const critPct = remainingPercent(settings.criticalMl, bag.initialVolumeMl);
  const accent = STATUS_META[bag.status].hex;
  const style = {
    borderColor: bag.status === 'NORMAL' ? '#e2e8f0' : accent,
    '--i': index,
  } as CSSProperties;

  return (
    <article className="ds-card ds-lift ds-reveal relative overflow-hidden bg-linear-to-b from-white to-slate-50/70 p-4 pl-5" style={style}>
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold text-navy-900">{bag.id}</h3>
          <p className="text-xs text-slate-500">{bag.name} · {bag.initialVolumeMl} mL bag</p>
        </div>
        <StatusBadge status={bag.status} />
      </header>

      <div className="mt-3 flex items-center gap-4">
        <FluidLevelIndicator percent={pct} status={bag.status} lowPercent={lowPct} criticalPercent={critPct} />
        <dl className="grid flex-1 grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <Metric label="Remaining" value={fault ? 'Unreliable' : <><CountUp value={bag.volumeMl} /> mL</>} />
          <Metric label="Percent" value={fault ? '—' : <><CountUp value={pct} /> %</>} />
          <Metric label="Flow rate" value={fault ? 'Unavailable' : formatFlow(bag.flowMlH)} />
          <Metric label="Time to empty" value={formatDuration(tte)} />
        </dl>
      </div>

      <footer className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          Last reading <span className="font-mono tabular-nums">{formatTime(bag.lastReadingAt)}</span>
          {live ? <LiveTag /> : <DemoTag />}
        </p>
        <button onClick={onOpen}
          className="group inline-flex items-center gap-1 rounded-lg bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-700 active:scale-[0.98]">
          Monitor <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
        </button>
      </footer>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="font-semibold tabular-nums text-navy-900">{value}</dd>
    </div>
  );
}
