import { Activity, BellRing, Droplet, LayoutDashboard, Settings as SettingsIcon, X } from 'lucide-react';
import type { PageId } from '../types';

const ITEMS: { id: PageId; label: string; icon: typeof Activity }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'live', label: 'Live Monitoring', icon: Activity },
  { id: 'history', label: 'Alert History', icon: BellRing },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

interface Props {
  page: PageId | null;
  onNavigate: (p: PageId) => void;
  pendingAlerts: number;
  open: boolean;
  onClose: () => void;
}

/** Nav rows are 40 px tall with a 4 px gap, so the active pill slides 44 px per item. */
const ITEM_STRIDE = 44;

export function Sidebar({ page, onNavigate, pendingAlerts, open, onClose }: Props) {
  const activeIndex = page ? ITEMS.findIndex((item) => item.id === page) : -1;
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden" onClick={onClose} aria-hidden />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-hidden bg-linear-to-b from-navy-900 to-navy-950 text-slate-200 shadow-[8px_0_32px_-24px_rgba(7,20,39,0.9)] transition-transform duration-300 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Main navigation"
      >
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-linear-to-b from-cyan-400/10 to-transparent" />
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2.5">
            <span className="rounded-xl bg-cyan-400/15 p-2 text-cyan-300 ring-1 ring-inset ring-cyan-300/20"><Droplet className="h-6 w-6" aria-hidden /></span>
            <div>
              <p className="text-lg font-bold leading-tight text-white">DropSafe</p>
              <p className="text-[11px] leading-tight text-cyan-200/80">IV bag remainder monitor</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-300 hover:bg-white/10 lg:hidden" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="relative mt-2 flex-1 space-y-1 px-3">
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 right-3 top-0 h-10 rounded-lg bg-cyan-400/10 ring-1 ring-cyan-400/25 shadow-[0_0_28px_-8px_rgba(34,211,238,0.65)] transition-transform duration-300 ease-out"
            style={{ transform: `translateY(${Math.max(0, activeIndex) * ITEM_STRIDE}px)`, opacity: activeIndex < 0 ? 0 : 1 }}
          />
          {ITEMS.map(({ id, label, icon: Icon }) => {
            const active = page === id;
            return (
              <button key={id} onClick={() => onNavigate(id)} aria-current={active ? 'page' : undefined}
                className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors duration-200 ${
                  active ? 'text-cyan-100' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
                <Icon className={`h-[18px] w-[18px] transition-transform duration-200 ${active ? 'text-cyan-300' : ''}`} aria-hidden />
                <span className="flex-1">{label}</span>
                {id === 'history' && pendingAlerts > 0 && (
                  <>
                    <span className="relative inline-flex">
                      <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white ds-pulse"
                        title="Unacknowledged alerts" aria-hidden>{pendingAlerts}</span>
                    </span>
                    <span className="sr-only">, {pendingAlerts} unacknowledged</span>
                  </>
                )}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
