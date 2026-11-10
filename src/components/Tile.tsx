import type { ReactNode } from 'react';

/** Generic metric tile used in LiveMonitoring and elsewhere. */
export type TileUrgency = 'normal' | 'warning' | 'critical';

const SURFACE: Record<TileUrgency, string> = {
  normal: 'border-slate-200 bg-slate-50/70',
  warning: 'border-amber-200 bg-linear-to-br from-amber-50 to-white',
  critical: 'border-rose-200 bg-linear-to-br from-rose-50 to-white',
};

const DOT: Record<TileUrgency, string> = {
  normal: 'bg-slate-300',
  warning: 'bg-amber-500',
  critical: 'bg-rose-500',
};

export function Tile({
  label,
  value,
  sub,
  urgency = 'normal',
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  urgency?: TileUrgency;
}) {
  const valueColor =
    urgency === 'critical'
      ? 'text-red-700'
      : urgency === 'warning'
        ? 'text-amber-700'
        : 'text-navy-900';
  return (
    <div className={`rounded-xl border p-3 transition-colors duration-300 ${SURFACE[urgency]}`}>
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {urgency !== 'normal' && <span className={`h-1.5 w-1.5 rounded-full ${DOT[urgency]}`} aria-hidden />}
        {label}
      </p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
