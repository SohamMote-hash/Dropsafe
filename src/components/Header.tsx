import { useEffect, useState } from 'react';
import { FlaskConical, Menu, Volume2, VolumeX } from 'lucide-react';
import type { MonitorSource } from '../types';

interface Props {
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenMenu: () => void;
  source: MonitorSource;
}

export function Header({ soundEnabled, onToggleSound, onOpenMenu, source }: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
      <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-cyan-500/40 to-transparent" />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <button onClick={onOpenMenu} className="rounded-lg p-2 text-navy-900 hover:bg-slate-100 lg:hidden" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
        <div className="mr-auto min-w-0">
          <p className="truncate text-sm font-semibold text-navy-900">
            {now.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
            <span className="ml-2 font-mono tabular-nums text-slate-600">{now.toLocaleTimeString([], { hour12: false })}</span>
          </p>
        </div>

        {source === 'SIMULATED' && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold tracking-wider text-amber-900 ring-1 ring-amber-500/40"
            title="Readings are generated in software">
            <FlaskConical className="h-3.5 w-3.5" aria-hidden /> DEMO MODE
          </span>
        )}
        <button onClick={onToggleSound} aria-pressed={soundEnabled}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition active:scale-[0.98] ${
            soundEnabled ? 'border-cyan-400 bg-cyan-50 text-cyan-800' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
          {soundEnabled ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
          Sound {soundEnabled ? 'on' : 'off'}
        </button>
      </div>
    </header>
  );
}
