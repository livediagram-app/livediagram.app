'use client';

// The notification list's popover (liveworkspace/docs/specs/016-notifications/toasts.md "The popover"): read-only,
// newest first, with Clear. Its own module so the bell loads it on first opening, not with every page.

import { lucideBell } from '@liveworkspace/icons/lucide';
import { CompactEmptyState } from '../CompactEmptyState';
import { lucideGlyph } from '../icons/lucide-glyph';
import { formatRelativeTimeShort } from '../relative-time';
import { ResponsivePopover } from '../ResponsivePopover';
import { TOAST_ICONS, TOAST_ICON_TINT } from './ToastCard';
import { clearToastHistory, type ToastRecord } from './toast-history';

const BellLargeIcon = lucideGlyph(lucideBell, 18);

/** The list's popover width from `sm` up. */
export const TOAST_LIST_WIDTH_PX = 360;

export default function ToastListPopover({
  open,
  onClose,
  anchor,
  titleId,
  records,
  now,
}: {
  open: boolean;
  onClose: () => void;
  anchor: HTMLElement | null;
  titleId: string;
  records: readonly ToastRecord[];
  now: number;
}) {
  return (
    <ResponsivePopover
      open={open}
      onClose={onClose}
      anchor={anchor}
      titleId={titleId}
      width={TOAST_LIST_WIDTH_PX}
      align="end"
      bare
    >
      <ToastList
        titleId={titleId}
        records={records}
        now={now}
        // Clearing is the last thing done here: the emptied list closes with it (owner, 2026-11-19).
        onClear={() => {
          clearToastHistory();
          onClose();
        }}
      />
    </ResponsivePopover>
  );
}

function ToastList({
  titleId,
  records,
  now,
  onClear,
}: {
  titleId: string;
  records: readonly ToastRecord[];
  now: number;
  onClear: () => void;
}) {
  return (
    <div className="flex max-h-[inherit] flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 py-2 pl-4 pr-2 dark:border-slate-700">
        <h2 id={titleId} className="text-sm font-semibold text-slate-900 dark:text-white">
          Notifications
        </h2>
        <button
          type="button"
          onClick={onClear}
          disabled={records.length === 0}
          className="touch-target relative inline-flex h-8 items-center rounded-lg px-2.5 text-sm font-semibold text-slate-600 transition enabled:hover:bg-slate-100 enabled:hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:enabled:hover:bg-slate-800 dark:enabled:hover:text-white"
        >
          Clear
        </button>
      </div>
      {records.length === 0 ? (
        <CompactEmptyState
          icon={<BellLargeIcon />}
          title="No notifications yet"
          description="Toasts you receive here are kept in this list."
        />
      ) : (
        <ul className="max-h-[22rem] overflow-y-auto py-1" aria-labelledby={titleId}>
          {records
            .slice()
            .reverse()
            .map((r) => {
              const Icon = TOAST_ICONS[r.tone];
              return (
                <li
                  key={r.id}
                  data-toast-tone={r.tone}
                  className="flex items-start gap-3 px-4 py-2"
                >
                  <span
                    aria-hidden
                    className={`flex h-5 shrink-0 items-center ${TOAST_ICON_TINT[r.tone]}`}
                  >
                    <Icon />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-5 text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100">
                      {r.message}
                    </p>
                    <p className="text-xs leading-4 text-slate-500 dark:text-slate-400">
                      <time dateTime={new Date(r.at).toISOString()}>
                        {formatRelativeTimeShort(Math.max(0, now - r.at))}
                      </time>
                    </p>
                  </div>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}
