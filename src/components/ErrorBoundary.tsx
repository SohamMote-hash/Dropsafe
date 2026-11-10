import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  error: Error | null;
}

/** Catches unexpected render errors so the dashboard never becomes a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('DropSafe render error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-full place-items-center px-4 py-16">
        <div className="ds-card w-full max-w-lg p-6 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-600/15">
            <AlertTriangle className="h-7 w-7" aria-hidden />
          </span>
          <h1 className="mt-4 text-xl font-bold text-navy-900">Something went wrong</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            The dashboard hit an unexpected error. Your settings and alert history are stored locally, so reloading
            should bring everything back.
          </p>
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-left font-mono text-xs text-slate-600">
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-700 active:scale-[0.98]"
          >
            <RotateCcw className="h-4 w-4" aria-hidden /> Reload dashboard
          </button>
        </div>
      </div>
    );
  }
}
