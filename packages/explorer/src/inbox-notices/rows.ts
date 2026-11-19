// Which Inbox rows notify, and what each says (inbox-notices.md "What notifies"): a mention, a comment on the
// reader's item or a reply in a thread they are in, an action or card handed to them, an access request on an item
// they manage, and their own request granted. Never their own move: a thread whose latest comment is theirs, work
// they assigned, a self-assignment. Every row comes from the reader's own Inbox read, which lists only items they
// reach, so a notice says nothing the Inbox row does not.

import type { App, InboxResponse, InboxThread } from '@liveworkspace/index-client';
import { APP_ITEMS, siteOfApp } from '@liveworkspace/sites';
import { actionKey, threadKey } from '../explorer/inbox/sections';
import type { SeenStore } from './seen';

/** A row older than this never notifies: it waits in the Inbox and its count. */
export const NOTICE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type NoticeKind = 'mention' | 'comment' | 'assigned' | 'access' | 'share';

export type NoticeRow = {
  key: string;
  at: number;
  kind: NoticeKind;
  app: App;
  /** Who, as the row names them ("Someone" when it names no one). */
  who: string;
  /** What they did: "mentioned you", "assigned you a card". */
  verb: string;
  /** The comment's first line, for a thread. */
  quote: string | null;
  /** The item's name, and the tab or the card where there is one. */
  place: string;
  detail: string | null;
  href: string;
};

const SOMEONE = 'Someone';
const QUOTE_MAX = 120;

const firstLine = (text: string): string | null => {
  const line =
    text
      .split('\n')
      .find((l) => l.trim())
      ?.trim() ?? '';
  if (!line) return null;
  return line.length > QUOTE_MAX ? `${line.slice(0, QUOTE_MAX - 1).trimEnd()}…` : line;
};

/** The Inbox at a row, on the row's app's own address (this app's on this address), so its Explorer lists it. */
export function inboxRowHref(rowApp: App, key: string, here: App): string {
  const origin = rowApp === here ? '' : siteOfApp(rowApp).url;
  return `${origin}/explorer/inbox?at=${encodeURIComponent(key)}`;
}

/** An item in its own app (this app's on this address). */
export function itemHref(rowApp: App, itemId: string, here: App): string {
  const origin = rowApp === here ? '' : siteOfApp(rowApp).url;
  return `${origin}${APP_ITEMS[rowApp].itemPath}${encodeURIComponent(itemId)}`;
}

function threadRow(t: InboxThread, viewerId: string, here: App): NoticeRow | null {
  if (t.resolved || !t.latestAuthorId || t.latestAuthorId === viewerId) return null;
  let kind: NoticeKind;
  let verb: string;
  let who = t.latestAuthorName || SOMEONE;
  if (t.mentionsYou) {
    kind = 'mention';
    verb = 'mentioned you';
    // Who mentioned the reader, unless that was the reader (a mention of themselves).
    if (t.mentionedBy?.name && t.mentionedBy.id !== viewerId) who = t.mentionedBy.name;
  } else if (t.onYourItem && !t.youCommented) {
    kind = 'comment';
    verb = 'commented';
  } else if (t.youCommented) {
    kind = 'comment';
    verb = 'replied';
  } else {
    // Reached only through the reader's agent: theirs, so not news.
    return null;
  }
  const key = threadKey(t);
  const label = t.card ? `#${t.card.key} ${t.card.title}` : t.tabName || null;
  return {
    key,
    at: t.latestAt,
    kind,
    app: t.app,
    who,
    verb,
    quote: firstLine(t.latestText),
    place: t.itemTitle,
    detail: label,
    href: inboxRowHref(t.app, key, here),
  };
}

/** Every row of an Inbox read that would notify this reader, newest first. A card thread read through two plans is
 *  one row, the newer. */
export function noticeRows(data: InboxResponse | null, viewerId: string, here: App): NoticeRow[] {
  if (!data) return [];
  const out: NoticeRow[] = [];
  const cardThreads = new Map<string, number>();
  for (const t of data.threads) {
    const row = threadRow(t, viewerId, here);
    if (!row) continue;
    if (t.card?.id) {
      const shared = `${t.app}:${t.elementId}`;
      const held = cardThreads.get(shared);
      if (held !== undefined) {
        if (out[held]!.at < row.at) out[held] = row;
        continue;
      }
      cardThreads.set(shared, out.length);
    }
    out.push(row);
  }
  for (const a of data.actions) {
    if (a.status !== 'open' || a.assigneeId !== viewerId || a.assignerId === viewerId) continue;
    const key = actionKey(a);
    out.push({
      key,
      at: a.updatedAt,
      kind: 'assigned',
      app: a.app,
      who: a.assignerName || SOMEONE,
      verb: a.card ? 'assigned you a card' : 'assigned you an action',
      quote: null,
      place: a.itemTitle,
      detail: a.card ? `#${a.card.key} ${a.card.title}` : a.name || null,
      href: inboxRowHref(a.app, key, here),
    });
  }
  for (const r of data.accessRequests ?? []) {
    if (r.requesterId === viewerId) continue;
    out.push({
      key: `r:${r.id}`,
      at: r.askedAt,
      kind: 'access',
      app: r.app,
      who: r.requesterName || SOMEONE,
      verb: 'asked for access',
      quote: r.note ? firstLine(r.note) : null,
      place: r.itemTitle,
      detail: null,
      href: itemHref(r.app, r.itemId, here),
    });
  }
  for (const s of data.shares ?? []) {
    if (s.sharedById === viewerId) continue;
    out.push({
      key: `s:${s.id}`,
      at: s.sharedAt,
      kind: 'share',
      app: s.app,
      who: s.sharedByName || SOMEONE,
      verb: 'shared it with you',
      quote: null,
      place: s.itemTitle,
      detail: null,
      href: itemHref(s.app, s.itemId, here),
    });
  }
  return out.sort((a, b) => b.at - a.at);
}

/** The rows that are news here: after this browser first watched, within a day, and not seen at that time. */
export function freshRows(
  rows: readonly NoticeRow[],
  seen: Pick<SeenStore, 'since' | 'has'>,
  now: number,
): NoticeRow[] {
  const since = seen.since();
  return rows.filter((r) => r.at > since && now - r.at <= NOTICE_MAX_AGE_MS && !seen.has(r));
}

/** A row's first line: "Priya mentioned you". */
export const noticeHeadline = (row: Pick<NoticeRow, 'who' | 'verb'>) => `${row.who} ${row.verb}`;
