'use client';

// The Inbox's rows (one-explorer-contracts.md "Inbox"): an action, a card, an element's thread, a card's thread and a
// form's new responses. Each row is one link into its app through the host's itemHref: an action opens its popover,
// a thread its comments, a card the card on its board, a form the board its responses land on. A row reads: the
// kind's glyph; the title with why it is here (Mentioned You, Your plan); a line of detail; the item's chip (team
// glyph for a team's item, This Browser for one only this browser holds) and where in it; and on the right the
// person behind it over how long ago.

import { memo, type ReactNode } from 'react';
import {
  APP_KINDS,
  type App,
  type CollabCard,
  type InboxAction,
  type InboxForm,
  type InboxThread,
} from '@liveworkspace/index-client';
import { initials } from '../../timeline/whatHappened';
import type { ItemPlace, Located } from '../../types';
import { RelativeTimeChip } from '../../ui/RelativeTimeChip';
import { ActionIcon, CardIcon, CommentIcon, FormIcon, TeamIcon } from '../../ui/icons';
import { AppMark } from '../badges';
import { useExplorer } from '../context';
import { threadHint } from './sections';

type Avatar = { name: string; detail: string; tone?: 'brand' | 'quiet'; color?: string };

type ShellProps = {
  app: App;
  itemId: string;
  itemTitle: string;
  itemTeamId: string | null;
  local?: boolean;
  place: ItemPlace;
  showApp: boolean;
  telemetry: string;
  icon: ReactNode;
  title: string;
  hint?: string | null;
  detail: string | null;
  where: string;
  avatar?: Avatar;
  at: number;
};

function RowShell(p: ShellProps) {
  const { Link, itemHref, inboxHost } = useExplorer();
  const href = itemHref(
    { id: p.itemId, app: p.app, kind: APP_KINDS[p.app], sharedVia: null },
    p.place,
  );
  return (
    <li data-inbox-row={p.telemetry}>
      <Link
        href={href}
        onClick={() => inboxHost?.onTelemetry?.('Selected', p.telemetry)}
        className="group flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-700"
      >
        <span aria-hidden className="mt-0.5 shrink-0 text-slate-400">
          {p.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-slate-900 group-hover:text-brand-700 dark:text-slate-100 dark:group-hover:text-brand-300">
              {p.title}
            </span>
            {p.hint ? (
              <span
                data-inbox-hint=""
                className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30"
              >
                {p.hint}
              </span>
            ) : null}
          </span>
          {p.detail ? (
            <span className="mt-0.5 line-clamp-1 block text-xs text-slate-500 dark:text-slate-400">
              {p.detail}
            </span>
          ) : null}
          <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            {p.showApp ? <AppMark app={p.app} size={14} /> : null}
            <span className="inline-flex max-w-[14rem] shrink-0 items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              {p.itemTeamId ? (
                <span aria-hidden className="text-slate-400">
                  <TeamIcon />
                </span>
              ) : null}
              <span className="truncate">{p.itemTitle || 'Untitled'}</span>
            </span>
            {p.local ? (
              <span
                data-this-browser=""
                className="shrink-0 rounded-full bg-sky-50 px-1.5 py-0.5 font-medium text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30"
              >
                This Browser
              </span>
            ) : null}
            {p.where ? <span className="truncate">{p.where}</span> : null}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          {p.avatar ? <AvatarDisc avatar={p.avatar} /> : null}
          <RelativeTimeChip at={p.at} />
        </span>
      </Link>
    </li>
  );
}

function AvatarDisc({ avatar }: { avatar: Avatar }) {
  const fill = avatar.color
    ? ''
    : avatar.tone === 'brand'
      ? 'bg-brand-700 dark:bg-brand-600'
      : 'bg-slate-400 dark:bg-slate-600';
  return (
    <span
      data-inbox-avatar=""
      title={`${avatar.name}: ${avatar.detail}`}
      aria-label={`${avatar.name}, ${avatar.detail}`}
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold text-white ${fill}`}
      style={avatar.color ? { backgroundColor: avatar.color } : undefined}
    >
      {initials(avatar.name) ?? '?'}
    </span>
  );
}

const elementWhere = (label: string, tabName: string) =>
  [label, tabName].filter(Boolean).join(' · ');

const cardWhere = (card: CollabCard) =>
  card.board ? `${card.board.title} · ${card.board.tabName}` : 'Not on a board';

const cardTitle = (card: CollabCard) =>
  card.key === null ? card.title : `#${card.key} ${card.title}`;

// A card opens on the board that shows it, or by itself when none does. Its id is the row's element id.
const cardPlace = (card: CollabCard, cardId: string): ItemPlace => ({
  tabId: card.board?.tabId ?? null,
  elementId: card.board?.elementId ?? null,
  cardId,
});

function CardGlyph({ type }: { type: string }) {
  const { inboxHost } = useExplorer();
  return <>{inboxHost?.cardGlyph?.(type) ?? <CardIcon />}</>;
}

function actionAvatar(a: InboxAction, forMe: boolean): Avatar {
  if (forMe) {
    return {
      name: 'You',
      detail: `Assigned by ${a.assignerName?.trim() || 'a teammate'}`,
      tone: 'brand',
    };
  }
  const assignee = a.assigneeName?.trim() || 'Teammate';
  return { name: assignee, detail: `Assigned to ${assignee}`, tone: 'quiet' };
}

const threadAvatar = (t: InboxThread): Avatar => ({
  name: t.latestAuthorName || 'A teammate',
  detail:
    t.commentCount === 1 ? '1 comment in this thread' : `${t.commentCount} comments in this thread`,
  color: t.latestAuthorColor || undefined,
});

const placeOf = <T extends Located<InboxAction | InboxThread>>(r: T) => ({
  app: r.app,
  itemId: r.itemId,
  itemTitle: r.itemTitle,
  itemTeamId: r.itemTeamId,
  local: r.local,
});

/** An action or a card assigned to or by the person; `forMe` when it is theirs to do. */
export const InboxActionRow = memo(function InboxActionRow({
  row,
  forMe,
  showApp,
}: {
  row: Located<InboxAction>;
  forMe: boolean;
  showApp: boolean;
}) {
  const card = row.card;
  if (card) {
    return (
      <RowShell
        {...placeOf(row)}
        place={cardPlace(card, row.elementId)}
        showApp={showApp}
        telemetry="Card"
        icon={<CardGlyph type={card.type} />}
        title={cardTitle(card)}
        detail={card.typeLabel || 'Card'}
        where={cardWhere(card)}
        avatar={actionAvatar(row, forMe)}
        at={row.updatedAt}
      />
    );
  }
  return (
    <RowShell
      {...placeOf(row)}
      place={{ tabId: row.tabId, elementId: row.elementId, open: 'action' }}
      showApp={showApp}
      telemetry="Action"
      icon={<ActionIcon />}
      title={row.name || 'Action'}
      detail={row.description || null}
      where={elementWhere(row.elementLabel, row.tabName)}
      avatar={actionAvatar(row, forMe)}
      at={row.updatedAt}
    />
  );
});

/** An unresolved thread the person is in: an element's, or a card's. */
export const InboxThreadRow = memo(function InboxThreadRow({
  row,
  showApp,
}: {
  row: Located<InboxThread>;
  showApp: boolean;
}) {
  const card = row.card;
  return (
    <RowShell
      {...placeOf(row)}
      place={
        card
          ? cardPlace(card, row.elementId)
          : { tabId: row.tabId, elementId: row.elementId, open: 'comments' }
      }
      showApp={showApp}
      telemetry={card ? 'CardThread' : 'Thread'}
      icon={card ? <CardGlyph type={card.type} /> : <CommentIcon />}
      title={card ? cardTitle(card) : row.elementLabel || 'Comment'}
      hint={threadHint(row)}
      detail={row.latestText || null}
      where={card ? cardWhere(card) : elementWhere('', row.tabName)}
      avatar={threadAvatar(row)}
      at={row.latestAt}
    />
  );
});

/** A form with responses the person hasn't seen: it opens the board they land on, else the form. */
export const InboxFormRow = memo(function InboxFormRow({
  row,
  showApp,
}: {
  row: InboxForm;
  showApp: boolean;
}) {
  return (
    <RowShell
      app={row.app}
      itemId={row.itemId}
      itemTitle={row.itemTitle}
      itemTeamId={row.itemTeamId}
      place={{ tabId: row.boardTabId ?? row.tabId }}
      showApp={showApp}
      telemetry="FormResponses"
      icon={<FormIcon />}
      title={`${row.unseen} new ${row.unseen === 1 ? 'response' : 'responses'} to ${row.heading}`}
      detail={null}
      where={row.boardTabId ? 'Responses on its board' : 'Responses on the form'}
      at={row.latestAt}
    />
  );
});
