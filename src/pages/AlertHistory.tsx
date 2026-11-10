import { useState } from 'react';
import { BellOff, Download, Trash2 } from 'lucide-react';
import { AlertHistoryTable } from '../components/AlertHistoryTable';
import { EmptyState } from '../components/EmptyState';
import { DemoTag, LiveTag } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { useMonitorContext } from '../state/MonitorContext';
import type { AlertEvent, AlertType, PageId } from '../types';

type Filter = 'ALL' | AlertType;
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'ALL', label: 'All alerts' },
  { id: 'LOW', label: 'Low fluid' },
  { id: 'CRITICAL', label: 'Critical' },
  { id: 'SENSOR_FAULT', label: 'Sensor faults' },
];

/** Serialises alert events to a CSV string. */
function toCSV(alerts: AlertEvent[]): string {
  const header = 'id,timestamp,bagId,type,volumeMl,acknowledged,acknowledgedAt,simulated';
  const rows = alerts.map((a) =>
    [
      a.id,
      new Date(a.timestamp).toISOString(),
      a.bagId,
      a.type,
      a.volumeMl,
      a.acknowledged,
      a.acknowledgedAt ? new Date(a.acknowledgedAt).toISOString() : '',
      a.simulated,
    ].join(',')
  );
  return [header, ...rows].join('\r\n');
}

/** Triggers a browser download of a text file. */
function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AlertHistory({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const { state, actions } = useMonitorContext();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [confirming, setConfirming] = useState(false);
  const { alerts } = state;
  const live = state.source !== 'SIMULATED';
  const shown = filter === 'ALL' ? alerts : alerts.filter((a) => a.type === filter);
  const countOf = (f: Filter) => (f === 'ALL' ? alerts.length : alerts.filter((a) => a.type === f).length);
  const activeFilter = FILTERS.find((f) => f.id === filter)?.label ?? 'selected';

  const handleExport = () => {
    try {
      const filename = `dropsafe-alerts-${new Date().toISOString().slice(0, 10)}.csv`;
      downloadText(toCSV(shown), filename);
      toast.success(`Exported ${shown.length} alert${shown.length === 1 ? '' : 's'} to CSV.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`CSV export failed: ${message}`);
    }
  };

  const acknowledge = (id: string) => {
    actions.acknowledgeAlert(id);
    toast.success('Alert acknowledged.');
  };

  const clearHistory = () => {
    actions.clearAlerts();
    setConfirming(false);
    toast.success('Alert history cleared.');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-navy-900">Alert History</h1>
        {live ? <LiveTag>LIVE SESSION</LiveTag> : <DemoTag>SIMULATED EVENTS</DemoTag>}
      </div>
      <p className="text-sm text-slate-600">
        One record is created each time a channel <em>changes</em> into a LOW, CRITICAL or SENSOR FAULT state.
        Acknowledging marks the record; it does not change the fluid status. Session history is saved in this
        browser; the chart history is also stored in Firebase.
      </p>

      {alerts.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="No alerts yet"
          description="Alerts will appear here when a channel changes to LOW, CRITICAL or SENSOR FAULT. Monitoring is running normally."
          action={{ label: 'Open live monitoring', onClick: () => onNavigate('live') }}
          secondaryAction={{ label: 'Review settings', onClick: () => onNavigate('settings') }}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter alerts">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  role="tab"
                  aria-selected={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                    filter === f.id
                      ? 'border-navy-900 bg-navy-900 text-white'
                      : 'border-slate-300 bg-white hover:bg-slate-50'
                  }`}
                >
                  {f.label} <span className="opacity-70">({countOf(f.id)})</span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExport}
                disabled={shown.length === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                title="Download current view as CSV"
              >
                <Download className="h-4 w-4" aria-hidden /> Export CSV
              </button>

              {confirming ? (
                <div
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm"
                  role="alertdialog"
                >
                  <span className="font-medium text-red-800">Delete all alert history?</span>
                  <button
                    onClick={clearHistory}
                    className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-red-700"
                  >
                    Yes, clear
                  </button>
                  <button
                    onClick={() => setConfirming(false)}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirming(true)}
                  disabled={alerts.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden /> Clear alert history
                </button>
              )}
            </div>
          </div>

          {shown.length === 0 ? (
            <EmptyState
              icon={BellOff}
              title={`No ${activeFilter.toLowerCase()}`}
              description="No alerts match this filter. Try another category or show the full history."
              action={{ label: 'Show all alerts', onClick: () => setFilter('ALL') }}
            />
          ) : (
            <AlertHistoryTable alerts={shown} onAcknowledge={acknowledge} />
          )}
        </>
      )}
    </div>
  );
}
