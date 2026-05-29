import type { ReactNode } from 'react';

type ModeBannerProps = {
  icon: ReactNode;
  message: string;
  actionLabel?: string;
  onAction: () => void;
};

// A floating status pill at the top of the canvas, used by editor "modes"
// (format painter, group, ...) to tell the user what the next click will do
// and to give them a way out (Cancel) or to wrap up (Done).
export function ModeBanner({ icon, message, actionLabel = 'Cancel', onAction }: ModeBannerProps) {
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-brand-200 bg-brand-50 py-1.5 pl-3 pr-1.5 text-sm text-brand-800 shadow-md"
    >
      <span className="flex items-center gap-2">
        {icon}
        {message}
      </span>
      <button
        type="button"
        onClick={onAction}
        className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
      >
        {actionLabel}
      </button>
    </div>
  );
}
