'use client';

// The footer's bell (liveworkspace/docs/specs/016-notifications/toasts.md "The notification list"): an icon button with
// no label, right of Settings in the editors' tab bar and the Explorer's bottom bar. A dot says the list holds a toast
// the person has not seen; pressing it opens the list, read-only and newest first, and marks it all seen. Leaving
// toasts collapse into it (toast-collapse.ts finds it by TOAST_BELL_ATTR). It reads the list's module store, so it
// works wherever the bar is drawn, inside the toast provider's tree or not.

import { Suspense, lazy, useId, useState, useSyncExternalStore } from 'react';
import { lucideBell } from '@liveworkspace/icons/lucide';
import { HoverCard } from '../HoverCard';
import { lucideGlyph } from '../icons/lucide-glyph';
import { TOAST_BELL_ATTR } from './toast-collapse';
import {
  hasMissedToast,
  markToastHistorySeen,
  announceToastListOpened,
  readToastHistory,
  subscribeToastHistory,
  type ToastRecord,
} from './toast-history';

const BellIcon = lucideGlyph(lucideBell, 16);

const EMPTY: readonly ToastRecord[] = [];
const onServer = () => EMPTY;
const read = () => readToastHistory();

// The list loads on first opening (or when the bell is pointed at or focused), keeping it off every page's first load.
const loadList = () => import('./ToastListPopover');
const ToastListPopover = lazy(loadList);

export function ToastBell({ className }: { className: string }) {
  const records = useSyncExternalStore(subscribeToastHistory, read, onServer);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  // When the list opened, for its "2 min ago"s (read once per opening, not per render).
  const [openedAt, setOpenedAt] = useState(0);
  const titleId = useId();
  const open = anchor !== null;
  // Mounted from the first opening on, so it can play its close.
  const [wanted, setWanted] = useState(false);
  const missed = hasMissedToast(records);

  return (
    <>
      <HoverCard title="Notifications" description="Every toast you received here, to read again.">
        <button
          type="button"
          {...{ [TOAST_BELL_ATTR]: '' }}
          aria-label={missed ? 'Notifications, new' : 'Notifications'}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={(e) => {
            if (open) {
              setAnchor(null);
              return;
            }
            setWanted(true);
            setOpenedAt(Date.now());
            setAnchor(e.currentTarget);
            markToastHistorySeen();
            announceToastListOpened();
          }}
          onPointerEnter={() => void loadList()}
          onFocus={() => void loadList()}
          className={className}
        >
          <BellIcon />
          {missed ? (
            <span
              aria-hidden
              data-toast-bell-dot=""
              className="pointer-events-none absolute right-1 top-1 h-2 w-2 rounded-full bg-brand-600 ring-2 ring-white dark:bg-brand-400 dark:ring-slate-900"
            />
          ) : null}
        </button>
      </HoverCard>
      {wanted ? (
        <Suspense fallback={null}>
          <ToastListPopover
            open={open}
            onClose={() => setAnchor(null)}
            anchor={anchor}
            titleId={titleId}
            records={records}
            now={openedAt}
          />
        </Suspense>
      ) : null}
    </>
  );
}
