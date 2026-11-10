import { Compass, LayoutDashboard, Activity } from 'lucide-react';
import type { PageId } from '../types';

export function NotFound({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  return (
    <div className="ds-card relative overflow-hidden px-6 py-16 text-center">
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-linear-to-b from-cyan-500/10 to-transparent" />
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-600/15">
        <Compass className="h-8 w-8" aria-hidden />
      </span>
      <p className="mt-5 text-5xl font-black tracking-tight text-navy-900">404</p>
      <h1 className="mt-2 text-2xl font-bold text-navy-900">Page not found</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
        The page you were looking for does not exist or has moved. Use one of the links below to get back to the
        dashboard.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => onNavigate('overview')}
          className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-700 active:scale-[0.98]"
        >
          <LayoutDashboard className="h-4 w-4" aria-hidden /> Back to overview
        </button>
        <button
          type="button"
          onClick={() => onNavigate('live')}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy-900 transition hover:bg-slate-50 active:scale-[0.98]"
        >
          <Activity className="h-4 w-4" aria-hidden /> Live monitoring
        </button>
      </div>
    </div>
  );
}
