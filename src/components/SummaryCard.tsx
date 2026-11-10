import type { LucideIcon } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { CountUp } from './CountUp';

type Tone = 'navy' | 'green' | 'amber' | 'red' | 'cyan';
const TONES: Record<Tone, string> = {
  navy: 'from-slate-500/15 to-slate-500/5 text-navy-800 ring-slate-900/10',
  green: 'from-emerald-500/20 to-emerald-500/5 text-emerald-700 ring-emerald-600/15',
  amber: 'from-amber-500/20 to-amber-500/5 text-amber-700 ring-amber-600/15',
  red: 'from-rose-500/20 to-rose-500/5 text-rose-700 ring-rose-600/15',
  cyan: 'from-cyan-500/20 to-cyan-500/5 text-cyan-700 ring-cyan-600/15',
};

export function SummaryCard(props: {
  label: string; value: ReactNode; hint?: string; icon: LucideIcon; tone: Tone; index?: number;
}) {
  const { label, value, hint, icon: Icon, tone, index = 0 } = props;
  return (
    <div className="ds-card ds-lift ds-reveal p-4" style={{ '--i': index } as CSSProperties}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <span className={`rounded-xl bg-linear-to-br p-1.5 ring-1 ring-inset ${TONES[tone]}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-navy-900">
        {typeof value === 'number' ? <CountUp value={value} /> : value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
