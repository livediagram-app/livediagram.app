'use client';

// The Inbox's rows (one-explorer-contracts.md "Inbox"; each product's 013-workspace/inbox.md "How a row reads"): an
// action, a card, an element's thread, a card's thread and a form's new responses. Each row is one link into its app
// through the host's itemHref: an action opens its popover, a thread its comments, a card the card on its board, a
// form the board its responses land on. The page and the editor's panel draw the same row, `comfortable` or
// `compact`. It reads: who is behind it (an avatar with the row's kind as a badge); where it is (app, item, tab,
// element) and when; what needs the person, in bold; the latest comment or the action's note; and why it is here
// (a chip, icon and words), with the card's type, the comment count and This Browser beside it.
//
// Rows can number in the hundreds: each is memoised on its row, holds no effect and asks for nothing. Its clock is
// the shared one (../../time), read by the time alone, so a tick re-renders the times and not the rows.

import { memo, useId, type ReactNode } from 'react';
import { formatRelativeTimeShort } from '@liveworkspace/ui';
import {
  APP_KINDS,
  type App,
  type CollabCard,
  type InboxAction,
  type InboxForm,
  type InboxThread,
} from '@liveworkspace/index-client';
import { relativeSince, useNow } from '../../time';
import { initials } from '../../timeline/whatHappened';
import type { ItemPlace, Located } from '../../types';
import { avatarFill } from '../../ui/avatar-fill';
import {
  ActionIcon,
  AtSignIcon,
  CardIcon,
  ChevronRightIcon,
  ClockIcon,
  CommentIcon,
  FormIcon,
  ReplyIcon,
  TeamIcon,
  UserIcon,
} from '../../ui/icons';
import { AppMark } from '../badges';
import { useExplorer } from '../context';
import { BrowserIcon } from '../host';
import { actionReason, formReason, threadReason, type InboxReason } from './sections';

/** The page's roomy row, or the editor panel's tighter one. */
export type InboxDensity = 'comfortable' | 'compact';

type Person = { name: string | null; color?: string };

type ShellProps = {
  app: App;
  itemId: string;
  itemTitle: string;
  itemTeamId: string | null;
  local?: boolean;
  place: ItemPlace;
  showApp: boolean;
  density: InboxDensity;
  telemetry: string;
  /** Who is behind the row; a form has no one, and shows its glyph instead. */
  person: Person | null;
  /** The row's kind, as a badge on the avatar. */
  badge: ReactNode;
  cardKey?: number | null;
  title: string;
  detail: { by?: string; text: string } | null;
  /** Inside the item, outermost first: the tab, then the element or board. */
  where: string[];
  reason: InboxReason | null;
  /** Who handed the person the work, after its reason ("by Sam Lee"). */
  reasonBy?: string | null;
  cardType?: { type: string; label: string } | null;
  comments?: number;
  at: number;
};

const ROW =
  'group flex w-full items-start text-left transition-colors duration-micro motion-reduce:transition-none hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 dark:hover:bg-slate-700/40 dark:focus-visible:bg-slate-700/40';
const ROW_DENSITY: Record<InboxDensity, string> = {
  comfortable: 'gap-3.5 px-4 py-3.5',
  compact: 'gap-2.5 px-3 py-3',
};

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

function RowShell(p: ShellProps) {
  const { Link, itemHref, inboxHost } = useExplorer();
  const id = useId();
  const compact = p.density === 'compact';
  const href = itemHref(
    { id: p.itemId, app: p.app, kind: APP_KINDS[p.app], sharedVia: null },
    p.place,
  );
  const item = p.itemTitle || 'Untitled';
  const fullTitle = p.cardKey == null ? p.title : `#${p.cardKey} ${p.title}`;
  const path = [item, ...p.where].join(' › ');
  // The panel has room for the item alone, readable rather than two names cut to a letter each; the page shows the
  // tab and the place too. The whole path is the line's tooltip and part of the row's name either way.
  const crumbs = compact ? [] : p.where;
  // One sensible sentence for a screen reader: what, why, where. The detail and the time describe it.
  const label = [
    fullTitle,
    p.reason ? `${p.reason.label}${p.reasonBy ? ` by ${p.reasonBy}` : ''}` : null,
    p.cardType ? p.cardType.label : null,
    p.comments ? plural(p.comments, 'comment') : null,
    `In ${[item, ...p.where].join(', ')}${p.local ? ', This Browser' : ''}`,
  ]
    .filter(Boolean)
    .join('. ');
  const detailId = `${id}d`;
  const timeId = `${id}t`;
  return (
    // Off-screen rows skip layout and paint until scrolled near (content-visibility), at about their own height.
    <li
      data-inbox-row={p.telemetry}
      data-density={p.density}
      className="[contain-intrinsic-size:auto_6rem] [content-visibility:auto]"
    >
      <Link
        href={href}
        aria-label={label}
        aria-describedby={p.detail ? `${detailId} ${timeId}` : timeId}
        onClick={() => inboxHost?.onTelemetry?.('Selected', p.telemetry)}
        className={`${ROW} ${ROW_DENSITY[p.density]}`}
      >
        <Lead person={p.person} badge={p.badge} compact={compact} />
        <span className="min-w-0 flex-1">
          <span
            title={path}
            className="flex min-w-0 items-center gap-1 text-xs text-slate-500 dark:text-slate-400"
          >
            {p.showApp ? <AppMark app={p.app} size={14} /> : null}
            {p.itemTeamId ? (
              <span aria-hidden className="shrink-0 text-slate-400 dark:text-slate-500">
                <TeamIcon size={12} />
              </span>
            ) : null}
            <span className="min-w-[3rem] shrink truncate font-medium text-slate-600 dark:text-slate-300">
              {item}
            </span>
            {crumbs.map((w, i) => (
              <Crumb key={i} text={w} />
            ))}
            <InboxTime id={timeId} at={p.at} compact={compact} />
          </span>
          <span
            data-inbox-title=""
            title={fullTitle}
            className={`mt-0.5 block truncate font-semibold text-slate-900 dark:text-slate-50 ${
              compact ? 'text-[13px] leading-5' : 'text-sm leading-5'
            }`}
          >
            {p.cardKey == null ? null : (
              <span className="mr-1 font-medium tabular-nums text-slate-400 dark:text-slate-500">
                #{p.cardKey}
              </span>
            )}
            {p.title}
          </span>
          {p.detail ? (
            <span
              id={detailId}
              data-inbox-detail=""
              className={`mt-0.5 line-clamp-2 text-slate-600 dark:text-slate-300 ${
                compact ? 'text-xs leading-[1.125rem]' : 'text-[13px] leading-5'
              }`}
            >
              {p.detail.by ? (
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {p.detail.by}:{' '}
                </span>
              ) : null}
              {p.detail.text}
            </span>
          ) : null}
          <span className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {p.reason ? <ReasonChip reason={p.reason} /> : null}
            {p.reasonBy ? (
              <span className="min-w-0 truncate text-[11px] text-slate-500 dark:text-slate-400">
                by {p.reasonBy}
              </span>
            ) : null}
            {p.cardType ? <CardTypeChip {...p.cardType} /> : null}
            {p.comments ? (
              <span
                data-inbox-comments={p.comments}
                title={plural(p.comments, 'comment')}
                className="inline-flex items-center gap-1 text-[11px] font-medium tabular-nums text-slate-500 dark:text-slate-400"
              >
                <CommentIcon size={12} />
                {p.comments}
              </span>
            ) : null}
            {p.local ? (
              <span
                data-this-browser=""
                title="Only in this browser"
                className="inline-flex items-center gap-1 rounded-full bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600"
              >
                <BrowserIcon size={11} />
                This Browser
              </span>
            ) : null}
          </span>
        </span>
        {compact ? null : (
          <span
            aria-hidden
            className="shrink-0 self-center text-slate-400 opacity-0 transition-opacity duration-micro group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none dark:text-slate-500"
          >
            <ChevronRightIcon size={16} />
          </span>
        )}
      </Link>
    </li>
  );
}

function Crumb({ text }: { text: string }) {
  return (
    <>
      <span aria-hidden className="shrink-0 px-0.5 text-slate-300 dark:text-slate-600">
        ›
      </span>
      <span className="min-w-0 shrink-[4] truncate">{text}</span>
    </>
  );
}

// A full date for the time's tooltip, one formatter for every row, worded on first hover: formatting 300 dates up
// front is a few milliseconds no one reads.
const FULL_DATE = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const fullDateOnHover = (at: number) => (e: { currentTarget: HTMLElement }) => {
  if (!e.currentTarget.title) e.currentTarget.title = FULL_DATE.format(at);
};

/** When the row last changed, on the shared clock: "8 mins ago", or "8 min ago" in the panel. */
function InboxTime({ id, at, compact }: { id: string; at: number; compact: boolean }) {
  const now = useNow();
  const valid = Number.isFinite(at) && at > 0;
  const text =
    now && valid ? (compact ? formatRelativeTimeShort(now - at) : relativeSince(at, now)) : '';
  return (
    <time
      id={id}
      dateTime={valid ? new Date(at).toISOString() : undefined}
      onPointerEnter={valid ? fullDateOnHover(at) : undefined}
      data-relative-time=""
      className="ml-auto shrink-0 pl-2 tabular-nums text-[11px] text-slate-500 dark:text-slate-400"
    >
      {text}
    </time>
  );
}

/** The person behind the row on a disc (their colour, darkened until white reads at AA; a quiet disc without one),
 *  or a form's glyph on a tile; the row's kind as a badge at its corner. Decorative: the row's name says it all. */
function Lead({
  person,
  badge,
  compact,
}: {
  person: Person | null;
  badge: ReactNode;
  compact: boolean;
}) {
  const size = compact ? 'size-8 text-[11px]' : 'size-9 text-xs';
  if (!person) {
    return (
      <span
        aria-hidden
        className={`mt-0.5 inline-flex shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30 ${size}`}
      >
        <FormIcon size={compact ? 16 : 18} />
      </span>
    );
  }
  const fill = person.color ? avatarFill(person.color) : null;
  const letters = person.name ? initials(person.name) : null;
  return (
    <span aria-hidden className="relative mt-0.5 shrink-0">
      <span
        data-inbox-avatar=""
        title={person.name ?? undefined}
        className={`inline-flex items-center justify-center rounded-full font-semibold ${size} ${
          fill ? 'text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-100'
        }`}
        style={fill ? { backgroundColor: fill } : undefined}
      >
        {letters ?? <UserIcon size={compact ? 14 : 16} />}
      </span>
      <span
        data-inbox-kind=""
        className="absolute -bottom-1 -right-1.5 inline-flex size-4 items-center justify-center rounded-full bg-white text-slate-500 ring-2 ring-white dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-800 [&_svg]:size-2.5"
      >
        {badge}
      </span>
    </span>
  );
}

const REASON_TONE: Record<InboxReason['kind'], string> = {
  assigned:
    'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-400/30',
  waiting:
    'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-700/60 dark:text-slate-200 dark:ring-slate-600',
  mention:
    'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-400/30',
  yours:
    'bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-400/30',
  replied:
    'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-700/60 dark:text-slate-200 dark:ring-slate-600',
  responses:
    'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-400/30',
};

function reasonIcon(kind: InboxReason['kind']) {
  switch (kind) {
    case 'assigned':
      return <ActionIcon size={12} />;
    case 'waiting':
      return <ClockIcon size={12} />;
    case 'mention':
      return <AtSignIcon size={12} />;
    case 'yours':
      return <UserIcon size={12} />;
    case 'replied':
      return <ReplyIcon size={12} />;
    case 'responses':
      return <FormIcon size={12} />;
  }
}

/** Why the row is here: an icon and its words, so it never rests on colour alone. */
function ReasonChip({ reason }: { reason: InboxReason }) {
  return (
    <span
      data-inbox-reason={reason.kind}
      className={`inline-flex min-w-0 max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${REASON_TONE[reason.kind]}`}
    >
      <span aria-hidden className="shrink-0">
        {reasonIcon(reason.kind)}
      </span>
      <span className="truncate">{reason.label}</span>
    </span>
  );
}

function CardGlyph({ type }: { type: string }) {
  const { inboxHost } = useExplorer();
  return <>{inboxHost?.cardGlyph?.(type) ?? <CardIcon />}</>;
}

/** A Plan card's type: its glyph, as the host draws it, and its name. */
function CardTypeChip({ type, label }: { type: string; label: string }) {
  return (
    <span
      data-inbox-card-type={type}
      className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-700/60 dark:text-slate-300 [&_svg]:size-3"
    >
      <span aria-hidden className="inline-flex shrink-0">
        <CardGlyph type={type} />
      </span>
      {label}
    </span>
  );
}

const cardWhere = (card: CollabCard) =>
  card.board ? [card.board.tabName, card.board.title].filter(Boolean) : ['Not on a board'];

// A card opens on the board that shows it, or by itself when none does. Its id is the row's element id.
const cardPlace = (card: CollabCard, cardId: string): ItemPlace => ({
  tabId: card.board?.tabId ?? null,
  elementId: card.board?.elementId ?? null,
  cardId,
});

const cardType = (card: CollabCard) => ({ type: card.type, label: card.typeLabel || 'Card' });

const nameOf = (name: string | null | undefined) => name?.trim() || null;

const placeOf = <T extends Located<InboxAction | InboxThread>>(r: T) => ({
  app: r.app,
  itemId: r.itemId,
  itemTitle: r.itemTitle,
  itemTeamId: r.itemTeamId,
  local: r.local,
});

/** An action or a card assigned to or by the person; `forMe` when it is theirs to do. Its avatar is whoever is on
 *  the other end: who handed it over, or who it waits on. */
export const InboxActionRow = memo(function InboxActionRow({
  row,
  forMe,
  showApp,
  density = 'comfortable',
}: {
  row: Located<InboxAction>;
  forMe: boolean;
  showApp: boolean;
  density?: InboxDensity;
}) {
  const card = row.card;
  const assigner = nameOf(row.assignerName);
  const shared = {
    ...placeOf(row),
    showApp,
    density,
    person: { name: forMe ? assigner : nameOf(row.assigneeName) },
    reason: actionReason(row, forMe),
    reasonBy: forMe ? (assigner ?? 'a teammate') : null,
    at: row.updatedAt,
  };
  if (card) {
    return (
      <RowShell
        {...shared}
        place={cardPlace(card, row.elementId)}
        telemetry="Card"
        badge={<CardGlyph type={card.type} />}
        cardKey={card.key}
        title={card.title || 'Card'}
        detail={null}
        where={cardWhere(card)}
        cardType={cardType(card)}
      />
    );
  }
  return (
    <RowShell
      {...shared}
      place={{ tabId: row.tabId, elementId: row.elementId, open: 'action' }}
      telemetry="Action"
      badge={<ActionIcon />}
      title={row.name || 'Action'}
      detail={row.description ? { text: row.description } : null}
      where={[row.tabName, row.elementLabel].filter(Boolean)}
    />
  );
});

/** An unresolved thread the person is in: an element's, or a card's. Its avatar is the latest comment's author. */
export const InboxThreadRow = memo(function InboxThreadRow({
  row,
  showApp,
  density = 'comfortable',
}: {
  row: Located<InboxThread>;
  showApp: boolean;
  density?: InboxDensity;
}) {
  const card = row.card;
  const author = nameOf(row.latestAuthorName);
  return (
    <RowShell
      {...placeOf(row)}
      place={
        card
          ? cardPlace(card, row.elementId)
          : { tabId: row.tabId, elementId: row.elementId, open: 'comments' }
      }
      showApp={showApp}
      density={density}
      telemetry={card ? 'CardThread' : 'Thread'}
      person={{ name: author, color: row.latestAuthorColor || undefined }}
      badge={<CommentIcon />}
      cardKey={card?.key ?? null}
      title={card ? card.title || 'Card' : row.elementLabel || 'Comment'}
      detail={row.latestText ? { by: author ?? 'A teammate', text: row.latestText } : null}
      where={card ? cardWhere(card) : [row.tabName].filter(Boolean)}
      reason={threadReason(row)}
      cardType={card ? cardType(card) : null}
      comments={row.commentCount}
      at={row.latestAt}
    />
  );
});

/** A form with responses the person hasn't seen: it opens the board they land on, else the form. */
export const InboxFormRow = memo(function InboxFormRow({
  row,
  showApp,
  density = 'comfortable',
}: {
  row: InboxForm;
  showApp: boolean;
  density?: InboxDensity;
}) {
  return (
    <RowShell
      app={row.app}
      itemId={row.itemId}
      itemTitle={row.itemTitle}
      itemTeamId={row.itemTeamId}
      place={{ tabId: row.boardTabId ?? row.tabId }}
      showApp={showApp}
      density={density}
      telemetry="FormResponses"
      person={null}
      badge={null}
      title={row.heading || 'Form'}
      detail={null}
      where={[row.boardTabId ? 'Responses on its board' : 'Responses on the form']}
      reason={formReason(row.unseen)}
      at={row.latestAt}
    />
  );
});

/** Rows of the same shape while the Inbox reads: an avatar, the breadcrumb, the title and a chip. */
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
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading your Inbox"
      data-inbox-skeleton=""
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
    >
      <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className={`flex items-start ${ROW_DENSITY[density]}`}>
            <span className={`${bar} shrink-0 rounded-full ${compact ? 'size-8' : 'size-9'}`} />
            <span className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
              <span className="flex items-center gap-2">
                <span className={`${bar} h-2.5 w-2/5`} />
                <span className={`${bar} ml-auto h-2.5 w-12`} />
              </span>
              <span className={`${bar} h-3.5 ${i % 2 ? 'w-3/5' : 'w-4/5'}`} />
              <span className={`${bar} h-4 w-24 rounded-full`} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
