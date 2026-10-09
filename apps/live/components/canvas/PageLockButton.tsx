'use client';

// A page's lock (docs/specs/007-editor/illustrate-pages.md "Locking a page"): a padlock in its
// title bar, before the cog, for someone who may edit. Open: Lock page. Closed and pressed: Unlock
// page, named Locked beside it on a desktop.
import { lucideLock, lucideLockOpen } from '@livediagram/icons/lucide';
import { lucideGlyph, Tooltip } from '@livediagram/ui';

const LockIcon = lucideGlyph(lucideLock, 14);
const OpenIcon = lucideGlyph(lucideLockOpen, 14);

// The title-bar room the button takes (24 px and the gap), wider with its label.
const ROOM = 28;
const LABELLED_ROOM = 76;

export function pageLockRoom(locked: boolean, labelled: boolean): number {
  return locked && labelled ? LABELLED_ROOM : ROOM;
}

export function PageLockButton({
  locked,
  labelled,
  onToggle,
}: {
  locked: boolean;
  // Named beside its icon while locked (a desktop).
  labelled: boolean;
  onToggle: () => void;
}) {
  const label = locked ? 'Unlock page' : 'Lock page';
  return (
    <div
      className="pointer-events-auto"
      // A press here is the button's, never the canvas's (no marquee, no deselect, no draw).
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <Tooltip label={label}>
        <button
          type="button"
          aria-label={label}
          aria-pressed={locked}
          data-page-lock={locked ? 'locked' : 'open'}
          onClick={onToggle}
          className={`flex h-6 items-center justify-center gap-1 rounded-md transition focus-visible:outline-2 focus-visible:outline-brand-600 ${
            locked && labelled ? 'px-1.5 text-[11px] font-medium' : 'w-6'
          } ${
            locked
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200'
              : 'text-slate-500 hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
          }`}
        >
          {locked ? <LockIcon /> : <OpenIcon />}
          {locked && labelled ? <span aria-hidden>Locked</span> : null}
        </button>
      </Tooltip>
    </div>
  );
}
