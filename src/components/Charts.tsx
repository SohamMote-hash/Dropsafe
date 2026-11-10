import type { ReactNode } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { Bag, BagStatus, Settings } from '../types';
import { remainingPercent } from '../lib/calculations';
import { formatTime } from '../lib/format';
import { STATUS_META } from '../lib/status';
import { useReducedMotion } from '../lib/useMotion';

const GRID = '#e2e8f0';
const AXIS = { fontSize: 11, fill: '#64748b' } as const;
const TOOLTIP = {
  contentStyle: {
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    boxShadow: '0 18px 36px -24px rgba(11,31,58,0.55)',
    fontSize: 12,
    padding: '8px 10px',
  },
  labelStyle: { color: '#334155', fontWeight: 600, marginBottom: 2 },
  itemStyle: { color: '#0b1f3a' },
};
const CURSOR = { stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' };
const ANIMATION_MS = 450;

function ChartEmpty({ title, note }: { title: string; note?: string }) {
  return (
    <ChartCard title={title} note={note}>
      <div className="grid h-64 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 text-center text-sm text-slate-500">
        Waiting for the first reading…
      </div>
    </ChartCard>
  );
}

function ChartCard({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="ds-card relative min-w-0 overflow-hidden p-4">
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-cyan-500/0 via-cyan-500/45 to-cyan-500/0" />
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-navy-900">{title}</h3>
        <span className="text-[10px] font-bold tracking-wider text-cyan-800">{note ?? 'DEMO DATA'}</span>
      </div>
      {children}
    </section>
  );
}

/** Remaining-fluid trend (last 60 points) with the two alert thresholds drawn as lines and an area fill. */
export function VolumeTrendChart({ bag, settings, live = false }: {
  bag: Bag; settings: Settings; live?: boolean;
}) {
  const reduced = useReducedMotion();
  const data = bag.history.map((p) => ({ time: formatTime(p.t), volume: p.volumeMl }));
  const gradId = `vol-grad-${bag.id}`;
  const title = `Remaining fluid — ${bag.id}`;
  if (data.length === 0) {
    return <ChartEmpty title={title} note={live ? 'LIVE DATA' : undefined} />;
  }
  return (
    <ChartCard title={title} note={live ? 'LIVE DATA' : undefined}>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0891b2" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#0891b2" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={AXIS} minTickGap={36} />
            <YAxis tick={AXIS} domain={[0, bag.initialVolumeMl]} unit=" mL" width={62} />
            <Tooltip {...TOOLTIP} cursor={CURSOR}
              formatter={(v) => (typeof v === 'number' ? `${v.toFixed(1)} mL` : 'Sensor fault')} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: '#475569' }} />
            <ReferenceLine
              y={settings.lowMl}
              stroke="#d97706"
              strokeDasharray="5 4"
              label={{ value: 'Low', fill: '#b45309', fontSize: 10, position: 'insideTopRight' }}
            />
            <ReferenceLine
              y={settings.criticalMl}
              stroke="#dc2626"
              strokeDasharray="5 4"
              label={{ value: 'Critical', fill: '#b91c1c', fontSize: 10, position: 'insideTopRight' }}
            />
            <Area
              type="monotone"
              dataKey="volume"
              name="Remaining volume (mL)"
              stroke="#0891b2"
              strokeWidth={2.5}
              fill={`url(#${gradId})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls={false}
              isAnimationActive={!reduced}
              animationDuration={ANIMATION_MS}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

/** Flow-rate estimate over time. Gaps mean "Unavailable". Area fill for visual weight. */
export function FlowRateChart({ bag, live = false }: { bag: Bag; live?: boolean }) {
  const reduced = useReducedMotion();
  const data = bag.history.map((p) => ({
    time: formatTime(p.t),
    flow: p.flowMlH === null ? null : Math.round(p.flowMlH),
  }));
  const gradId = `flow-grad-${bag.id}`;
  const title = `Estimated flow rate — ${bag.id}`;
  if (data.length === 0) {
    return <ChartEmpty title={title} note={live ? 'LIVE DATA' : undefined} />;
  }
  return (
    <ChartCard title={title} note={live ? 'LIVE DATA' : undefined}>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={AXIS} minTickGap={36} />
            <YAxis tick={AXIS} domain={[0, 'auto']} unit=" mL/h" width={74} allowDecimals={false} />
            <Tooltip {...TOOLTIP} cursor={CURSOR}
              formatter={(v) => (typeof v === 'number' ? `${v} mL/h` : 'Unavailable')} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: '#475569' }} />
            <Area
              type="monotone"
              dataKey="flow"
              name="Flow rate (mL/h)"
              stroke="#2563eb"
              strokeWidth={2.5}
              fill={`url(#${gradId})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls={false}
              isAnimationActive={!reduced}
              animationDuration={ANIMATION_MS}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

const ORDER: BagStatus[] = ['NORMAL', 'LOW', 'CRITICAL', 'SENSOR_FAULT'];

/** Donut of how many channels are in each state right now. */
export function StatusDistributionChart({ bags, live = false }: { bags: Bag[]; live?: boolean }) {
  const reduced = useReducedMotion();
  const rows = ORDER.map((s) => ({
    status: s,
    name: STATUS_META[s].label,
    value: bags.filter((b) => b.status === s).length,
  }));
  return (
    <ChartCard title="Status distribution" note={live ? 'LIVE + DEMO' : undefined}>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <div className="h-48 w-48 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rows.filter((r) => r.value > 0)}
                dataKey="value"
                nameKey="name"
                innerRadius={48}
                outerRadius={78}
                paddingAngle={2}
                isAnimationActive={!reduced}
                animationDuration={500}
              >
                {rows
                  .filter((r) => r.value > 0)
                  .map((r) => <Cell key={r.status} fill={STATUS_META[r.status].hex} />)}
              </Pie>
              <Tooltip {...TOOLTIP} formatter={(v, n) => [`${v} channel(s)`, n]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="w-full space-y-1.5 text-sm">
          {rows.map((r) => (
            <li key={r.status} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm" style={{ background: STATUS_META[r.status].hex }} />
                {r.name}
              </span>
              <span className="font-bold tabular-nums text-navy-900">{r.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  );
}

/** Horizontal comparison of remaining percentage for every channel. */
export function RemainingBarChart({ bags, live = false }: { bags: Bag[]; live?: boolean }) {
  const reduced = useReducedMotion();
  const data = bags.map((b) => ({
    name: b.id,
    percent: Math.round(remainingPercent(b.volumeMl, b.initialVolumeMl)),
    status: b.status,
  }));
  return (
    <ChartCard title="Remaining fluid by channel" note={live ? 'LIVE + DEMO' : undefined}>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={AXIS} unit="%" />
            <YAxis type="category" dataKey="name" tick={AXIS} width={48} />
            <Tooltip {...TOOLTIP} cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
              formatter={(v) => `${v} %`} />
            <Bar dataKey="percent" name="Remaining (%)" radius={[0, 6, 6, 0]}
              isAnimationActive={!reduced} animationDuration={500}>
              {data.map((d) => (
                <Cell
                  key={d.name}
                  fill={d.status === 'SENSOR_FAULT' ? '#94a3b8' : STATUS_META[d.status].hex}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
