import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

interface Action {
  label: string;
  onClick: () => void;
}

export function EmptyState(props: {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: Action;
  secondaryAction?: Action;
}) {
  const { title, description, icon: Icon = Inbox, action, secondaryAction } = props;
  return (
    <div className="ds-card flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-600/15">
        <Icon className="h-7 w-7" aria-hidden />
      </span>
      <h2 className="text-lg font-bold text-navy-900">{title}</h2>
      <p className="max-w-md text-sm leading-relaxed text-slate-600">{description}</p>
      {(action || secondaryAction) && (
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-700 active:scale-[0.98]"
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy-900 transition hover:bg-slate-50 active:scale-[0.98]"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
