import { Droplets, Pause, Play, RotateCcw, ShieldCheck, TriangleAlert, Siren, ZapOff, BellOff } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Bag, Settings } from '../types';
import { MANUAL_REDUCE_ML } from '../state/monitor';
import type { MonitorApi } from '../state/useMonitor';
import { useToast } from './Toast';

type Actions = MonitorApi['actions'];

function Btn(props: {
  onClick: () => void; icon: ReactNode; children: ReactNode; tone?: 'default' | 'primary' | 'amber' | 'red' | 'violet' | 'green';
  disabled?: boolean; title?: string;
}) {
  const tones = {
    default: 'border-slate-300 bg-white text-navy-900 hover:bg-slate-50',
    primary: 'border-navy-900 bg-navy-900 text-white hover:bg-navy-700',
    amber: 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100',
    red: 'border-red-300 bg-red-50 text-red-800 hover:bg-red-100',
    violet: 'border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100',
    green: 'border-green-300 bg-green-50 text-green-800 hover:bg-green-100',
  };
  return (
    <button onClick={props.onClick} disabled={props.disabled} title={props.title}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${tones[props.tone ?? 'default']}`}>
      {props.icon}{props.children}
    </button>
  );
}

export function ControlPanel(props: {
  bag: Bag; settings: Settings; running: boolean; actions: Actions; needsAck: boolean;
}) {
  const { bag, settings, running, actions, needsAck } = props;
  const toast = useToast();
  const ic = 'h-4 w-4';
  const run = (message: string, action: () => void) => {
    action();
    toast.success(message);
  };
  return (
    <section className="ds-card p-4">
      <h3 className="text-sm font-bold text-navy-900">Demo controls <span className="font-normal text-slate-500">· {bag.id}</span></h3>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {running ? (
          <Btn tone="primary" onClick={() => run('Demo paused.', () => actions.setRunning(false))} icon={<Pause className={ic} />}>Pause demo</Btn>
        ) : (
          <Btn tone="primary" onClick={() => run('Demo resumed.', () => actions.setRunning(true))} disabled={!settings.autoUpdates}
            title={settings.autoUpdates ? undefined : 'Automatic demo updates are turned off in Settings'}
            icon={<Play className={ic} />}>Start demo</Btn>
        )}
        <Btn onClick={() => run(`${bag.id} reset to ${bag.initialVolumeMl} mL.`, () => actions.resetBag(bag.id))}
          icon={<RotateCcw className={ic} />}>Reset bag</Btn>
        <Btn onClick={() => run(`Removed ${MANUAL_REDUCE_ML} mL from ${bag.id}.`, () => actions.reduceBag(bag.id))}
          icon={<Droplets className={ic} />}
          title="Removes fluid immediately, for testing">Reduce by {MANUAL_REDUCE_ML} mL</Btn>
        <Btn tone="amber" onClick={() => run(`${bag.id} set to a simulated LOW level.`, () => actions.simulateLevel(bag.id, 'LOW'))}
          icon={<TriangleAlert className={ic} />}>Simulate LOW</Btn>
        <Btn tone="red" onClick={() => run(`${bag.id} set to a simulated CRITICAL level.`, () => actions.simulateLevel(bag.id, 'CRITICAL'))}
          icon={<Siren className={ic} />}>Simulate CRITICAL</Btn>
        <Btn tone="violet" onClick={() => run(`${bag.id} sensor fault simulated.`, () => actions.simulateFault(bag.id))}
          icon={<ZapOff className={ic} />}>Simulate sensor fault</Btn>
        <Btn tone="green" onClick={() => run(`${bag.id} restored to normal.`, () => actions.restoreNormal(bag.id))}
          icon={<ShieldCheck className={ic} />}
          title="Clears a sensor fault and lifts the level above the LOW threshold">Restore normal</Btn>
        <Btn onClick={() => run(`${bag.id} alert acknowledged.`, () => actions.acknowledgeBag(bag.id))}
          disabled={!needsAck} icon={<BellOff className={ic} />}
          title="Silences the alarm. Does not change the fluid status.">Acknowledge alert</Btn>
      </div>
      {!settings.autoUpdates && (
        <p className="mt-3 text-xs text-slate-500">Automatic updates are off (Settings). Manual test controls still work.</p>
      )}
    </section>
  );
}
