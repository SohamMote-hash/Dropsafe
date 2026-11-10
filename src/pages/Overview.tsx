import { useState } from 'react';
import { Activity, Plus, Siren, CheckCircle2, Droplets, TriangleAlert } from 'lucide-react';
import { AddBagDialog, type NewBag } from '../components/AddBagDialog';
import { EmptyState } from '../components/EmptyState';
import { IVBagCard } from '../components/IVBagCard';
import { RemainingBarChart, StatusDistributionChart } from '../components/Charts';
import { SummaryCard } from '../components/SummaryCard';
import { DemoTag, LiveTag } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { nextBagId } from '../data/sensorProvider';
import { useMonitorContext } from '../state/MonitorContext';
import type { PageId } from '../types';

export function Overview({ onNavigate }: { onNavigate: (p: PageId) => void }) {
  const { state, actions } = useMonitorContext();
  const { bags, settings } = state;
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const nextId = nextBagId(state.bagConfigs);
  const count = (f: (s: string) => boolean) => bags.filter((b) => f(b.status)).length;
  const normal = count((s) => s === 'NORMAL');
  const attention = count((s) => s === 'LOW' || s === 'SENSOR_FAULT');
  const critical = count((s) => s === 'CRITICAL');
  const live = state.source !== 'SIMULATED';

  const addBag = (bag: NewBag) => {
    actions.addBag(bag);
    toast.success(`${bag.name} added as ${nextId}.`);
  };

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-navy-900">Overview</h1>
        {live ? <LiveTag /> : <DemoTag />}
      </div>
      <button onClick={() => setAddOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-navy-700 active:scale-[0.98]">
        <Plus className="h-4 w-4" aria-hidden /> Add IV bag
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {header}

      {bags.length === 0 ? (
        <EmptyState
          icon={Droplets}
          title="No monitoring channels"
          description="Add an IV bag to start monitoring, or review the connection settings."
          action={{ label: 'Add IV bag', onClick: () => setAddOpen(true) }}
          secondaryAction={{ label: 'Review settings', onClick: () => onNavigate('settings') }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard label="Monitored bags" value={bags.length} index={0}
              hint={live ? 'Live channel and demo bags' : 'Simulated channels'} icon={Droplets} tone="navy" />
            <SummaryCard label="Normal" value={normal} hint="Above low threshold" icon={CheckCircle2} tone="green" index={1} />
            <SummaryCard label="Needs attention" value={attention} hint="Low or sensor fault" icon={TriangleAlert} tone="amber" index={2} />
            <SummaryCard label="Critical alerts" value={critical} hint="At or below critical" icon={Siren} tone="red" index={3} />
          </div>

          <section aria-label="IV bag channels" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {bags.map((bag, index) => (
              <IVBagCard key={bag.id} bag={bag} settings={settings} live={live} index={index}
                onOpen={() => { actions.selectBag(bag.id); onNavigate('live'); }} />
            ))}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <StatusDistributionChart bags={bags} live={live} />
            <RemainingBarChart bags={bags} live={live} />
          </div>

          <p className="flex items-center gap-2 text-xs text-slate-500">
            <Activity className="h-4 w-4" aria-hidden />
            {live
              ? 'The live channel is updated by the ESP32 through the Firebase gateway. Added demo bags stay simulated and are marked as sensor faults while live mode is active.'
              : 'Values come from a software simulation (time is sped up so bags empty within minutes). Not connected to any real IV bag.'}
          </p>
        </>
      )}

      <AddBagDialog open={addOpen} nextId={nextId}
        onClose={() => setAddOpen(false)} onAdd={addBag} />
    </div>
  );
}
