import { AlertTriangle, CheckCircle2, Siren, ZapOff } from 'lucide-react';
import type { BagStatus } from '../types';
import { STATUS_META } from '../lib/status';

const ICONS = { NORMAL: CheckCircle2, LOW: AlertTriangle, CRITICAL: Siren, SENSOR_FAULT: ZapOff } as const;

export function StatusBadge({ status, large = false }: { status: BagStatus; large?: boolean }) {
  const Icon = ICONS[status];
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ring-1 ring-inset transition-colors duration-300 ${meta.badge} ${
        large ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <Icon className={large ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden />
      {meta.label}
    </span>
  );
}

/** Small tag that marks any simulated number or record. */
export function DemoTag({ children = 'DEMO DATA' }: { children?: string }) {
  return (
    <span className="inline-flex items-center rounded border border-cyan-300 bg-cyan-50 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-cyan-800">
      {children}
    </span>
  );
}

/** Marks readings that arrived from the ESP32 through Firebase. */
export function LiveTag({ children = 'LIVE DATA' }: { children?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-green-300 bg-green-50 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-green-800">
      <span className="relative flex h-1.5 w-1.5" aria-hidden>
        <span className="absolute h-1.5 w-1.5 rounded-full bg-green-500 ds-ping" />
        <span className="relative h-1.5 w-1.5 rounded-full bg-green-500" />
      </span>
      {children}
    </span>
  );
}
