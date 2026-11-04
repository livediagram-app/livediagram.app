'use client';

// A page's lock (docs/specs/007-editor/pages-mode.md "Locking a page"): a padlock in its
// title bar, before the cog, for someone who may edit. Open: Lock page. Closed and pressed: Unlock
// page, named Locked beside it on a desktop.
import { lucideLock, lucideLockOpen } from '@liveworkspace/icons/lucide';
import { lucideGlyph, Tooltip } from '@liveworkspace/ui';
import { TITLE_BAR_BUTTON, titleBarButtonClass } from './PageTitleBar';

const LockIcon = lucideGlyph(lucideLock, 14);
const OpenIcon = lucideGlyph(lucideLockOpen, 14);

// The title-bar room the button takes (PageTitleBar's button, its gap counted by the bar), wider
// with its label.
const ROOM = TITLE_BAR_BUTTON;
const LABELLED_ROOM = 72;

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
    <Tooltip label={label}>
      <button
        type="button"
        // Its name says what a press does; no aria-pressed as well, or it reads "Unlock page, pressed".
        aria-label={label}
        data-page-lock={locked ? 'locked' : 'open'}
        onClick={onToggle}
        className={`relative touch-target-y ${
          locked
            ? `${titleBarButtonClass(false, locked && labelled)} !bg-amber-100 !text-amber-800 hover:!bg-amber-200 dark:!bg-amber-500/20 dark:!text-amber-200`
            : titleBarButtonClass(false, false)
        }`}
      >
        {locked ? <LockIcon /> : <OpenIcon />}
        {locked && labelled ? <span aria-hidden>Locked</span> : null}
      </button>
    </Tooltip>
  );
}
