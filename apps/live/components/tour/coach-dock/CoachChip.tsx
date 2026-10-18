'use client';

// The tour chip (docs/specs/007-editor/coach-dock.md "The offer"): an offer left alone folds into this small pill in
// the tab bar, before Search, so the tour stays one press away without standing over anything. ▶ starts the tour at
// its first step; × declines it for good. With no tab bar (zen mode) it sits at the right of the dock slot; with
// neither (a surface outside the editor) at the bottom right of the window.
import { createPortal } from 'react-dom';
import { CloseIcon, HoverCard, Portal } from '@livediagram/ui';
import { PlayIcon } from '@/components/primitives/PlayIcon';
import { useCoachSlot } from './coach-dock-slots';

export function CoachChip({
  label,
  about,
  onStart,
  onDismiss,
}: {
  // "Slides Tour".
  label: string;
  // What the tour shows, for the Start hover card: "A short tour of slides, on your own slide."
  about: string;
  onStart: () => void;
  onDismiss: () => void;
}) {
  const chipSlot = useCoachSlot('chip');
  const dockSlot = useCoachSlot('dock');
  const chip = (
    <span
      data-coach-chip=""
      data-tour-popover=""
      onPointerDown={(e) => e.stopPropagation()}
      className="inline-flex h-7 animate-fade-in items-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-200 motion-reduce:animate-none dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/40"
    >
      <HoverCard title="Take the Tour" description={about}>
        <button
          type="button"
          onClick={onStart}
          className="relative flex h-7 touch-target-y cursor-pointer items-center gap-1.5 rounded-l-full pl-2.5 pr-2 text-xs font-semibold transition hover:bg-brand-100 dark:hover:bg-brand-500/25"
        >
          <PlayIcon size={10} />
          {label}
        </button>
      </HoverCard>
      <span aria-hidden className="h-4 w-px bg-brand-200 dark:bg-brand-500/40" />
      <HoverCard title="No Thanks" description="Hide this tour. Settings › Tours offers it again.">
        <button
          type="button"
          onClick={onDismiss}
          aria-label={`No Thanks: hide the ${label}`}
          className="relative flex h-7 w-7 touch-target cursor-pointer items-center justify-center rounded-r-full transition hover:bg-brand-100 dark:hover:bg-brand-500/25"
        >
          <CloseIcon />
        </button>
      </HoverCard>
    </span>
  );
  if (chipSlot) return createPortal(chip, chipSlot);
  if (dockSlot)
    return createPortal(
      <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
        {chip}
      </div>,
      dockSlot,
    );
  return (
    <Portal>
      <div className="fixed bottom-4 right-4 z-[var(--z-toast)]">{chip}</div>
    </Portal>
  );
}
