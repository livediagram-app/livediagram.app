import type { ReactNode } from 'react';
import { TopCenterBanner } from './TopCenter';

type ModeBannerProps = {
  icon: ReactNode;
  message: string;
  actionLabel?: string;
  onAction: () => void;
  // Optional extra controls (icon-only toggle buttons) rendered to
  // the LEFT of the Cancel action. Used by the pen banner today for
  // the "recognise shapes" toggle so the user can flip the mode
  // without leaving the gesture. Future modes can hang their own
  // small toggles off the same slot.
  extras?: ReactNode;
};

// A floating status pill at the top of the canvas, used by editor "modes"
// (format painter, group, ...) to tell the user what the next click will do
// and to give them a way out (Cancel) or to wrap up (Done).
export function ModeBanner({
  icon,
  message,
  actionLabel = 'Cancel',
  onAction,
  extras,
}: ModeBannerProps) {
  return (
    <TopCenterBanner
      tone="brand"
      className="gap-3 py-1.5 pl-3 pr-1.5 text-sm"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span className="flex items-center gap-2">
        {icon}
        {message}
      </span>
      {extras}
      <button
        type="button"
        onClick={onAction}
        className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
      >
        {actionLabel}
      </button>
    </TopCenterBanner>
  );
}
