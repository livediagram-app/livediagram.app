'use client';

// The notice card (inbox-notices.md "How a notice looks"): a notice in the toast stack, bottom centre, where every toast
// sits (toasts.md "One place for everything that pops up"), in the toast's stacked card: the kind's icon, who and what
// as its title, the quote and the place under it at the card's full width, or a group's first three rows each a link
// of their own and "and n more", and its one link on the foot row. Dismiss at its top right. It holds the notice slot
// while it shows, takes no focus; Escape inside it dismisses; the pointer on it or focus in it holds it on screen.
// Announced once, politely.

import { useEffect, useRef, type ReactNode } from 'react';
import { Portal } from '@liveworkspace/ui';
import { ToastCard, ToastNotice } from '@liveworkspace/ui/toast';
import {
  ActionIcon,
  AtSignIcon,
  CardIcon,
  CommentIcon,
  InboxIcon,
  LockIcon,
  ShareIcon,
  EyeIcon,
  VideoIcon,
  ZapIcon,
} from '../ui/icons';
import { NOTICE_LINES_MAX, type Notice } from './center';
import { noticeHeadline, type NoticeKind, type NoticeRow } from './rows';

function kindIcon(row: NoticeRow, size = 16): ReactNode {
  const icons: Record<NoticeKind, ReactNode> = {
    mention: <AtSignIcon size={size} />,
    comment: <CommentIcon size={size} />,
    assigned: row.verb.includes('card') ? <CardIcon size={size} /> : <ActionIcon size={size} />,
    access: <LockIcon size={size} />,
    share: <ShareIcon size={size} />,
    update: <EyeIcon size={size} />,
    call: <VideoIcon size={size} />,
    automation: <ZapIcon size={size} />,
  };
  return icons[row.kind];
}

const linkWords = (row: NoticeRow) => (row.kind === 'share' ? 'Open' : 'Open in Inbox');
const placeWords = (row: NoticeRow) => (row.detail ? `${row.place} › ${row.detail}` : row.place);

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
    <>
      {/* Always there while mounted, so a screen reader hears each notice once as it fills. */}
      <Portal>
        <div role="status" aria-live="polite" className="sr-only">
          {notice ? heading : ''}
        </div>
      </Portal>
      {notice ? (
        <ToastNotice>
          <ToastCard
            key={notice.id}
            ref={rootRef}
            tone="info"
            role="group"
            data-inbox-notice=""
            data-floating-panel=""
            aria-label={`Inbox notice: ${heading}`}
            icon={single ? kindIcon(single) : <InboxIcon size={16} />}
            title={heading}
            message={
              single?.quote ? <span className="line-clamp-2">“{single.quote}”</span> : undefined
            }
            body={
              single ? (
                <p className="truncate text-xs leading-4 text-slate-500 dark:text-slate-400">
                  {placeWords(single)}
                </p>
              ) : (
                <ul className="space-y-0.5">
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
              )
            }
            actions={[
              {
                label: single ? linkWords(single) : 'Open Inbox',
                href: single ? single.href : inboxHref,
                onSelect: onFollow,
                primary: true,
              },
            ]}
            onClose={onDismiss}
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
          />
        </ToastNotice>
      ) : null}
    </>
  );
}
