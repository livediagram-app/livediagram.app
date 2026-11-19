'use client';

// The notice card (inbox-notices.md "How a notice looks"): under the editor's top-right corner card, the corner
// card's surface, one row's who and what with its quote and place and one link, or a group's first three rows each
// a link of their own, "and n more", and Open Inbox. Dismiss at its top right. It takes no focus; Escape inside it
// dismisses; the pointer on it or focus in it holds it on screen. Announced once, politely.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Portal, Tooltip } from '@liveworkspace/ui';
import {
  ActionIcon,
  AtSignIcon,
  CardIcon,
  CommentIcon,
  DismissIcon,
  InboxIcon,
  LockIcon,
  ShareIcon,
} from '../ui/icons';
import { NOTICE_LINES_MAX, type Notice } from './center';
import { noticeHeadline, type NoticeKind, type NoticeRow } from './rows';

/** How far under the corner card the notice hangs, and from the top with no corner card. */
const GAP_PX = 8;
const TOP_PX = 12;
const CORNER_CARD = '[data-corner-actions]';

function kindIcon(row: NoticeRow, size = 14): ReactNode {
  const icons: Record<NoticeKind, ReactNode> = {
    mention: <AtSignIcon size={size} />,
    comment: <CommentIcon size={size} />,
    assigned: row.verb.includes('card') ? <CardIcon size={size} /> : <ActionIcon size={size} />,
    access: <LockIcon size={size} />,
    share: <ShareIcon size={size} />,
  };
  return icons[row.kind];
}

const linkWords = (row: NoticeRow) =>
  row.kind === 'access' || row.kind === 'share' ? 'Open' : 'Open in Inbox';
const placeWords = (row: NoticeRow) => (row.detail ? `${row.place} › ${row.detail}` : row.place);

/** Where the card hangs: under the corner card when the editor draws one, read when it shows and on resize. */
function useHangTop(shown: boolean): number {
  const [top, setTop] = useState(TOP_PX);
  useLayoutEffect(() => {
    if (!shown) return;
    const place = () => {
      const card = document.querySelector<HTMLElement>(CORNER_CARD);
      const bottom = card?.getBoundingClientRect().bottom ?? 0;
      setTop(bottom > 0 ? Math.round(bottom + GAP_PX) : TOP_PX);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [shown]);
  return top;
}

const ICON_DISC =
  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200';
const PRIMARY =
  'inline-flex h-8 cursor-pointer items-center rounded-lg bg-brand-700 px-3 text-xs font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:bg-brand-600 dark:hover:bg-brand-500';
const LINE =
  'block cursor-pointer rounded-md px-1.5 py-1 -mx-1.5 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-slate-800';

export type InboxNoticeProps = {
  notice: Notice | null;
  /** The Inbox itself, for a group's Open Inbox. */
  inboxHref: string;
  onDismiss: () => void;
  onFollow: () => void;
  onHold: (held: boolean) => void;
};

export function InboxNotice({ notice, inboxHref, onDismiss, onFollow, onHold }: InboxNoticeProps) {
  const top = useHangTop(notice !== null);
  const rootRef = useRef<HTMLDivElement>(null);
  // Gone with focus or the pointer in it: let the next notice run its own time.
  useEffect(() => {
    if (notice === null) onHold(false);
  }, [notice, onHold]);
  const rows = notice?.rows ?? [];
  const single = rows.length === 1 ? rows[0]! : null;
  const shown = rows.slice(0, NOTICE_LINES_MAX);
  const more = rows.length - shown.length;
  const heading = single ? noticeHeadline(single) : `${rows.length} New in Your Inbox`;
  return (
    <Portal>
      {/* Always there while mounted, so a screen reader hears each notice once as it fills. */}
      <div role="status" aria-live="polite" className="sr-only">
        {notice ? heading : ''}
      </div>
      {notice ? (
        <div
          key={notice.id}
          ref={rootRef}
          data-inbox-notice=""
          data-floating-panel=""
          aria-label={`Inbox notice: ${heading}`}
          role="group"
          style={{ top }}
          onPointerEnter={() => onHold(true)}
          onPointerLeave={() => onHold(false)}
          onFocus={() => onHold(true)}
          onBlur={(e) => {
            if (!rootRef.current?.contains(e.relatedTarget as Node | null)) onHold(false);
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            onDismiss();
          }}
          // Chrome, not canvas: a press here never reaches the canvas's gestures.
          onPointerDown={(e) => e.stopPropagation()}
          className="lw-inbox-notice pointer-events-auto fixed right-3 z-[var(--z-modal)] w-80 rounded-xl border border-slate-200 bg-white p-3 text-slate-700 shadow-lg shadow-slate-900/10 phone:left-4 phone:right-4 phone:w-auto dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:shadow-slate-950/50"
        >
          <div className="flex items-start gap-2.5">
            <span className={ICON_DISC} aria-hidden="true">
              {single ? kindIcon(single) : <InboxIcon size={15} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="pr-6 text-sm font-semibold leading-5 text-slate-900 dark:text-white">
                {heading}
              </p>
              {single ? (
                <>
                  {single.quote ? (
                    <p className="mt-0.5 line-clamp-2 text-[13px] leading-[18px] text-slate-600 dark:text-slate-300">
                      “{single.quote}”
                    </p>
                  ) : null}
                  <p className="mt-0.5 truncate text-xs leading-4 text-slate-500 dark:text-slate-400">
                    {placeWords(single)}
                  </p>
                </>
              ) : (
                <ul className="mt-1 space-y-0.5">
                  {shown.map((row) => (
                    <li key={row.key}>
                      <a href={row.href} className={LINE} onClick={onFollow}>
                        <span className="block truncate text-[13px] font-medium leading-[18px] text-slate-800 dark:text-slate-100">
                          {noticeHeadline(row)}
                        </span>
                        <span className="block truncate text-xs leading-4 text-slate-500 dark:text-slate-400">
                          {placeWords(row)}
                        </span>
                      </a>
                    </li>
                  ))}
                  {more > 0 ? (
                    <li className="px-0.5 pt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      and {more} more
                    </li>
                  ) : null}
                </ul>
              )}
              <div className="mt-2.5 flex">
                <a href={single ? single.href : inboxHref} className={PRIMARY} onClick={onFollow}>
                  {single ? linkWords(single) : 'Open Inbox'}
                </a>
              </div>
            </div>
          </div>
          <Tooltip label="Dismiss">
            <button
              type="button"
              aria-label="Dismiss"
              onClick={onDismiss}
              className="absolute right-2 top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <DismissIcon size={14} />
            </button>
          </Tooltip>
        </div>
      ) : null}
    </Portal>
  );
}
