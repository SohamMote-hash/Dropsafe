import { AlertTriangle, BellOff, CheckCheck, Siren, ZapOff } from 'lucide-react';
import type { Alarm, AlertType } from '../types';
import { STATUS_META } from '../lib/status';
import { formatMl } from '../lib/format';
import type { Settings } from '../types';
import { useToast } from './Toast';

const ICON = { LOW: AlertTriangle, CRITICAL: Siren, SENSOR_FAULT: ZapOff } as const;

function message(a: Alarm, s: Settings): string {
  const type: AlertType = a.type;
  if (type === 'CRITICAL') return `Critical fluid level: ${formatMl(a.volumeMl)} remaining (at or below ${s.criticalMl} mL).`;
  if (type === 'LOW') return `Low fluid level: ${formatMl(a.volumeMl)} remaining (at or below ${s.lowMl} mL).`;
  return `Sensor fault: reading is unreliable. Last valid estimate ${formatMl(a.volumeMl)}.`;
}

export function AlertBanner(props: {
  alarms: Alarm[]; settings: Settings; onAcknowledge: (bagId: string) => void; live?: boolean;
}) {
  const { alarms, settings, onAcknowledge, live = false } = props;
  const toast = useToast();
  if (alarms.length === 0) return null;
  const ordered = [...alarms].sort((a, b) => Number(a.acknowledged) - Number(b.acknowledged));
  return (
    <div className="ds-reveal space-y-2" role="region" aria-label="Active alerts">
      {ordered.map((a) => {
        const Icon = ICON[a.type];
        const meta = STATUS_META[a.type];
        return (
          <div key={a.bagId}
            className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 shadow-sm ${meta.banner} ${
              a.acknowledged ? 'opacity-80' : ''}`}
            role={a.acknowledged ? 'status' : 'alert'}>
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/60 ring-1 ring-inset ring-black/5 ${
              a.acknowledged ? '' : 'ds-pulse'}`}>
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <p className="min-w-0 flex-1 text-sm">
              <strong>{a.bagId}</strong> — {message(a, settings)}
              {!live && <span className="ml-2 text-xs font-semibold opacity-70">(simulated)</span>}
            </p>
            {a.acknowledged ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold">
                <CheckCheck className="h-4 w-4" aria-hidden /> Acknowledged · status unchanged
              </span>
            ) : (
              <button onClick={() => { onAcknowledge(a.bagId); toast.success(`${a.bagId} alert acknowledged.`); }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold shadow-sm ring-1 ring-black/10 transition hover:bg-slate-50 active:scale-[0.98]">
                <BellOff className="h-4 w-4" aria-hidden /> Acknowledge
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
