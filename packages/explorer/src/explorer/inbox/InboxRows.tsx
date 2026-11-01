'use client';

// The Inbox's list rows (one-explorer-contracts.md "Inbox"; each product's 013-workspace/inbox.md "How a row reads"):
// an action, a card, an element's thread, a card's thread and a form's new responses, each three lines:
//
//   who (semibold when it needs you)                                  when
//   what: the action, the card's #number and title, the element a thread is on, the form's heading
//   why (a status icon and its words) · the app's Living Prism and the item · This Browser
//
// A row is an option of the list's listbox: choosing it shows it in the reading pane (./InboxReader), and the pane
// opens it in its app. The page and the editor's panel draw the same row, `comfortable` or `compact`.
//
// Rows can number in the hundreds: each is memoised on its entry and whether it is chosen, holds no effect and asks
// for nothing, so moving the selection re-renders two rows. Its clock is the shared one (../../time), read by the
// time alone, so a tick re-renders the times and not the rows.

import { memo, type ReactNode } from 'react';
import { PictureDisc } from '@liveworkspace/ui';
import { DAY_MONTH, MEDIUM_DATE_TIME } from '@liveworkspace/ui/date-format';
import { usePersonPicture } from '../../data/usePeople';
import { initials } from '../../timeline/whatHappened';
import { useNow } from '../../time';
import { avatarFill } from '../../ui/avatar-fill';
import {
  ActionIcon,
  AtSignIcon,
  ClockIcon,
  FileTextIcon,
  FormIcon,
  ReplyIcon,
  UserIcon,
} from '../../ui/icons';
import { AppMark } from '../badges';
import { ThisBrowserPill } from '../ThisBrowser';
import { useExplorer } from '../context';
import { useExtras } from '../extras';
import {
  actionReason,
  formReason,
  threadReason,
  type InboxEntry,
  type InboxReason,
} from './sections';

/** The page's roomy row, or the editor panel's tighter one. */
export type InboxDensity = 'comfortable' | 'compact';

// `id`: the person, whose Google picture the Explorer's one people store brings with their name (one batched request
// for every row on screen, never one per avatar); `picture`: one the host already has.
type Person = { id?: string | null; name: string | null; color?: string; picture?: string | null };

/** What a row and the pane say about an entry: who is behind it, what it is, why it is here and where. Worked out
 *  from the entry alone, so it is cheap and the same in both places. */
export type EntryFacts = {
  person: Person | null;
  who: string;
  /** It asks something of the person: theirs to do, a mention, a thread on their item, new responses. */
  needsYou: boolean;
  cardKey: number | null;
  title: string;
  reason: InboxReason | null;
  /** The item's title, then the tab and the element or board, outermost first. */
  item: string;
  where: string[];
  cardType: { type: string; label: string } | null;
  local: boolean;
};

const nameOf = (name: string | null | undefined) => name?.trim() || null;

export function entryFacts(e: InboxEntry, viewerId: string | null): EntryFacts {
  const local = 'local' in e.row && e.row.local === true;
  const item = e.row.itemTitle || 'Untitled';
  switch (e.kind) {
    case 'Action':
    case 'Card': {
      const r = e.row;
      const card = r.card;
      const other = e.forMe ? r.assignerId : r.assigneeId;
      const otherName = e.forMe ? nameOf(r.assignerName) : nameOf(r.assigneeName);
      const self = Boolean(viewerId && other === viewerId);
      return {
        person: { id: self ? null : other, name: self ? null : otherName },
        who: self ? 'You' : (otherName ?? 'A teammate'),
        needsYou: e.forMe,
        cardKey: card?.key ?? null,
        title: card ? card.title || 'Card' : r.name || 'Action',
        reason: actionReason(r, e.forMe),
        item,
        where: card
          ? card.board
            ? [card.board.tabName, card.board.title].filter(Boolean)
            : []
          : [r.tabName, r.elementLabel].filter(Boolean),
        cardType: card ? { type: card.type, label: card.typeLabel || 'Card' } : null,
        local,
      };
    }
    case 'Thread':
    case 'CardThread': {
      const r = e.row;
      const card = r.card;
      const mine = Boolean(viewerId && r.latestAuthorId === viewerId);
      const author = nameOf(r.latestAuthorName);
      const reason = threadReason(r, viewerId);
      return {
        person: {
          id: mine ? null : r.latestAuthorId,
          name: mine ? null : author,
          color: r.latestAuthorColor || undefined,
        },
        who: mine ? 'You' : (author ?? 'A teammate'),
        needsYou: reason?.kind === 'mention' || reason?.kind === 'yours',
        // One of a card's threads (card.id set) is titled by the thread, and placed on its card; a row from before
        // threads was the card's one conversation, titled by the card.
        cardKey: card && !card.id ? card.key : null,
        title: card?.id
          ? r.elementLabel || 'Comment thread'
          : card
            ? card.title || 'Card'
            : r.elementLabel || 'Comment',
        reason,
        item,
        where: card
          ? [
              ...(card.board ? [card.board.tabName, card.board.title] : []),
              ...(card.id ? [card.key !== null ? `#${card.key} ${card.title}` : card.title] : []),
            ].filter(Boolean)
          : [r.tabName].filter(Boolean),
        cardType: card ? { type: card.type, label: card.typeLabel || 'Card' } : null,
        local,
      };
    }
    case 'FormResponses': {
      const r = e.row;
      return {
        person: null,
        who: 'Form responses',
        needsYou: true,
        cardKey: null,
        title: r.heading || 'Form',
        reason: formReason(r.unseen),
        item,
        where: [],
        cardType: null,
        local: false,
      };
    }
  }
}

export function reasonIcon(kind: InboxReason['kind'], size = 12): ReactNode {
  switch (kind) {
    case 'assigned':
      return <ActionIcon size={size} />;
    case 'waiting':
      return <ClockIcon size={size} />;
    case 'mention':
      return <AtSignIcon size={size} />;
    case 'yours':
      return <FileTextIcon size={size} />;
    case 'replied':
      return <ReplyIcon size={size} />;
    case 'responses':
      return <FormIcon size={size} />;
  }
}

const ROW =
  'relative flex w-full cursor-pointer items-start text-left transition-colors duration-micro motion-reduce:transition-none';
const ROW_IDLE = 'hover:bg-slate-50 dark:hover:bg-slate-700/40';
const ROW_CHOSEN =
  'bg-brand-50/70 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-brand-600 dark:bg-brand-500/10 dark:before:bg-brand-400';
// The listbox's active row when the list has keyboard focus: a ring, so the selection never rests on the tint alone.
const ROW_ACTIVE =
  'group-focus-visible/list:outline-2 group-focus-visible/list:-outline-offset-2 group-focus-visible/list:outline-brand-500';
const ROW_DENSITY: Record<InboxDensity, string> = {
  comfortable: 'min-h-[4.75rem] gap-3 px-4 py-3',
  compact: 'min-h-[4.5rem] gap-2.5 px-3 py-2.5',
};

/** One row of the Inbox's listbox. `onPick` chooses it (a click or a tap); the list moves the choice by keyboard. */
export const InboxRow = memo(function InboxRow({
  entry,
  id,
  selected,
  showApp,
  density,
  viewerId,
  onPick,
}: {
  entry: InboxEntry;
  id: string;
  selected: boolean;
  showApp: boolean;
  density: InboxDensity;
  viewerId: string | null;
  onPick: (key: string) => void;
}) {
  const f = entryFacts(entry, viewerId);
  const compact = density === 'compact';
  const fullTitle = f.cardKey == null ? f.title : `#${f.cardKey} ${f.title}`;
  const path = [f.item, ...f.where].join(' › ');
  // One sentence for a screen reader: what, why, who, where.
  const label = [
    fullTitle,
    f.reason?.label,
    f.who,
    `In ${[f.item, ...f.where].join(', ')}${f.local ? ', This Browser' : ''}`,
  ]
    .filter(Boolean)
    .join('. ');
  return (
    // Off-screen rows skip layout and paint until scrolled near (content-visibility), at about their own height.
    <li
      id={id}
      role="option"
      aria-selected={selected}
      aria-label={label}
      data-inbox-row={entry.kind}
      data-inbox-key={entry.key}
      data-density={density}
      onClick={() => onPick(entry.key)}
      className={`${ROW} ${ROW_DENSITY[density]} ${selected ? `${ROW_CHOSEN} ${ROW_ACTIVE}` : ROW_IDLE} [contain-intrinsic-size:auto_4.75rem] [content-visibility:auto]`}
    >
      <Lead person={f.person} compact={compact} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline gap-2">
          <span
            data-inbox-who=""
            className={`min-w-0 flex-1 truncate text-[13px] leading-5 ${
              f.needsYou
                ? 'font-semibold text-slate-900 dark:text-slate-50'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {f.who}
          </span>
          <InboxTime at={entry.at} />
        </span>
        <span
          data-inbox-title=""
          title={fullTitle}
          className="block truncate text-[13px] font-medium leading-5 text-slate-900 dark:text-slate-100"
        >
          {f.cardKey == null ? null : (
            <span className="mr-1 tabular-nums text-slate-500 dark:text-slate-400">
              #{f.cardKey}
            </span>
          )}
          {f.title}
        </span>
        <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs leading-5 text-slate-600 dark:text-slate-300">
          {f.reason ? <Status reason={f.reason} /> : null}
          {f.reason ? (
            <span aria-hidden className="shrink-0 text-slate-300 dark:text-slate-600">
              ·
            </span>
          ) : null}
          <span title={path} className="flex min-w-0 items-center gap-1">
            {showApp ? <AppMark app={entry.row.app} size={13} /> : null}
            <span className="min-w-0 truncate text-slate-500 dark:text-slate-400">{f.item}</span>
          </span>
          {f.local ? <ThisBrowserPill inLink /> : null}
        </span>
      </span>
    </li>
  );
});

/** Why the row is here: an icon and its words, so it never rests on colour alone. */
export function Status({ reason }: { reason: InboxReason }) {
  return (
    <span
      data-inbox-reason={reason.kind}
      className="inline-flex shrink-0 items-center gap-1 font-medium text-slate-700 dark:text-slate-200"
    >
      <span aria-hidden className="shrink-0 text-slate-500 dark:text-slate-400">
        {reasonIcon(reason.kind)}
      </span>
      {reason.label}
    </span>
  );
}

// A full date for the time's tooltip, one formatter for every row, worded on first hover: formatting 300 dates up
// front is a few milliseconds no one reads.
const FULL_DATE = MEDIUM_DATE_TIME;
const fullDateOnHover = (at: number) => (e: { currentTarget: HTMLElement }) => {
  if (!e.currentTarget.title) e.currentTarget.title = FULL_DATE.format(at);
};

const SHORT_DATE = DAY_MONTH;

/** A row's age in a few characters: "now", "12m", "3h", "2d", then the date ("12 Oct"). */
export function shortAgo(at: number, now: number): string {
  const mins = Math.floor((now - at) / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d` : SHORT_DATE.format(at);
}

/** When the row last changed, on the shared clock: "12m", "3h", "2d". */
function InboxTime({ at }: { at: number }) {
  const now = useNow();
  const valid = Number.isFinite(at) && at > 0;
  const text = now && valid ? shortAgo(at, now) : '';
  return (
    <time
      dateTime={valid ? new Date(at).toISOString() : undefined}
      onPointerEnter={valid ? fullDateOnHover(at) : undefined}
      data-relative-time=""
      className="shrink-0 tabular-nums text-[11px] text-slate-500 dark:text-slate-400"
    >
      {text}
    </time>
  );
}

/** The person behind the row on a disc (their Google picture where they have one, over their colour darkened until
 *  white reads at AA; a quiet disc without one), or a form's glyph on a tile. Decorative: the row says who in words. */
export function Lead({ person, compact }: { person: Person | null; compact: boolean }) {
  const { people } = useExtras();
  const known = usePersonPicture(people, person && !person.picture ? person.id : null);
  const size = compact ? 'size-8 text-[11px]' : 'size-9 text-xs';
  if (!person) {
    return (
      <span
        aria-hidden
        className={`mt-0.5 inline-flex shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-700/60 dark:text-slate-300 dark:ring-slate-600 ${size}`}
      >
        <FormIcon size={compact ? 16 : 18} />
      </span>
    );
  }
  const fill = person.color ? avatarFill(person.color) : null;
  const letters = person.name ? initials(person.name) : null;
  return (
    <PictureDisc
      aria-hidden
      data-inbox-avatar=""
      pictureUrl={person.picture ?? known}
      name={person.name ?? ''}
      size={compact ? 32 : 36}
      className={`mt-0.5 font-semibold ${size} ${
        fill ? 'text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-100'
      }`}
      style={fill ? { backgroundColor: fill } : undefined}
    >
      {letters ?? <UserIcon size={compact ? 14 : 16} />}
    </PictureDisc>
  );
}

/** A Plan card's type glyph, as the host draws it. */
export function CardGlyph({ type }: { type: string }) {
  const { inboxHost } = useExplorer();
  return <>{inboxHost?.cardGlyph?.(type) ?? null}</>;
}

/** Rows of the same shape while the Inbox reads: an avatar and three lines. */
export function InboxSkeleton({
  count = 4,
  density = 'comfortable',
}: {
  count?: number;
  density?: InboxDensity;
}) {
  const compact = density === 'compact';
  const bar = 'animate-pulse rounded bg-slate-200 motion-reduce:animate-none dark:bg-slate-700';
  return (
    <div role="status" aria-busy="true" aria-label="Loading your Inbox" data-inbox-skeleton="">
      <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className={`flex items-start ${ROW_DENSITY[density]}`}>
            <span className={`${bar} shrink-0 rounded-full ${compact ? 'size-8' : 'size-9'}`} />
            <span className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
              <span className="flex items-center gap-2">
                <span className={`${bar} h-2.5 w-2/5`} />
                <span className={`${bar} ml-auto h-2.5 w-8`} />
              </span>
              <span className={`${bar} h-3.5 ${i % 2 ? 'w-3/5' : 'w-4/5'}`} />
              <span className={`${bar} h-2.5 w-1/2`} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
