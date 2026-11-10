import { CheckCircle2, Clock } from 'lucide-react';
import type { AlertEvent } from '../types';
import { ALERT_LABEL, STATUS_META } from '../lib/status';
import { formatDateTime, formatMl } from '../lib/format';
import { DemoTag, LiveTag } from './StatusBadge';

const volumeLabel = (alert: AlertEvent) =>
  alert.type === 'SENSOR_FAULT' ? `${formatMl(alert.volumeMl)} (last valid)` : formatMl(alert.volumeMl);

function SourceTag({ simulated }: { simulated: boolean }) {
  return simulated ? <DemoTag>SIMULATED EVENT</DemoTag> : <LiveTag>LIVE EVENT</LiveTag>;
}

function AcknowledgementState({ alert, onAcknowledge }: {
  alert: AlertEvent; onAcknowledge: (id: string) => void;
}) {
  if (alert.acknowledged) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5 text-green-700">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
        <span>Acknowledged{alert.acknowledgedAt ? ` ${formatDateTime(alert.acknowledgedAt)}` : ''}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-amber-700">
        <Clock className="h-4 w-4 shrink-0" aria-hidden />Pending
      </span>
      <button
        type="button"
        onClick={() => onAcknowledge(alert.id)}
        className="rounded-md border border-slate-300 px-2 py-0.5 text-xs font-semibold transition hover:bg-slate-100"
      >
        Acknowledge
      </button>
    </span>
  );
}

export function AlertHistoryTable({ alerts, onAcknowledge }: {
  alerts: AlertEvent[]; onAcknowledge: (id: string) => void;
}) {
  return (
    <>
      <ul className="space-y-3 md:hidden">
        {alerts.map((alert) => (
          <li key={alert.id} className="ds-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-navy-900">{alert.bagId}</p>
                <p className="mt-0.5 font-mono text-xs text-slate-500">{formatDateTime(alert.timestamp)}</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
                <span className="h-2 w-2 rounded-full" style={{ background: STATUS_META[alert.type].hex }} />
                {ALERT_LABEL[alert.type]}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-slate-500">Volume at event</dt>
                <dd className="font-semibold text-navy-900">{volumeLabel(alert)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Source</dt>
                <dd className="mt-0.5"><SourceTag simulated={alert.simulated} /></dd>
              </div>
            </dl>
            <div className="mt-3 border-t border-slate-100 pt-3 text-xs">
              <AcknowledgementState alert={alert} onAcknowledge={onAcknowledge} />
            </div>
          </li>
        ))}
      </ul>

      <div className="ds-card hidden overflow-hidden md:block">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="w-[22%] px-4 py-3">Timestamp</th>
              <th scope="col" className="w-[10%] px-4 py-3">Bag</th>
              <th scope="col" className="w-[18%] px-4 py-3">Alert type</th>
              <th scope="col" className="w-[16%] px-4 py-3">Volume at event</th>
              <th scope="col" className="w-[24%] px-4 py-3">Acknowledgement</th>
              <th scope="col" className="w-[10%] px-4 py-3">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {alerts.map((alert) => (
              <tr key={alert.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3 font-mono text-xs">{formatDateTime(alert.timestamp)}</td>
                <td className="px-4 py-3 font-semibold text-navy-900">{alert.bagId}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STATUS_META[alert.type].hex }} />
                    {ALERT_LABEL[alert.type]}
                  </span>
                </td>
                <td className="px-4 py-3">{volumeLabel(alert)}</td>
                <td className="px-4 py-3">
                  <AcknowledgementState alert={alert} onAcknowledge={onAcknowledge} />
                </td>
                <td className="px-4 py-3"><SourceTag simulated={alert.simulated} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
