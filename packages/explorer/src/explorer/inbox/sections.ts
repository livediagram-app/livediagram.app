// The Inbox's model (one-explorer-contracts.md "Inbox"): what the index and the host's This Browser rows hold, split
// by whose move it is (assigned to the person, assigned by them, form responses, open threads), then laid out as one
// list, newest first, under date dividers, with a filter bar over it. The sidebar's count is the work waiting on the
// person: what is assigned to them, This Browser's rows included. It shows 0 once read, so an empty Inbox reads as
// done; forms, threads and work they handed out are not counted.

import type { InboxAction, InboxForm, InboxThread } from '@liveworkspace/index-client';
import type { Located } from '../../types';
import type { InboxData } from '../../data/useInbox';
import { kindWords } from '../../words';

export type InboxSections = {
  forMe: Located<InboxAction>[];
  byMe: Located<InboxAction>[];
  forms: InboxForm[];
  threads: Located<InboxThread>[];
};

const NONE: InboxSections = { forMe: [], byMe: [], forms: [], threads: [] };

// With no viewer id (signed out), every open action reads as theirs.
export function inboxSections(data: InboxData | null, viewerId: string | null): InboxSections {
  if (!data) return NONE;
  const open = data.actions.filter((a) => a.status === 'open');
  return {
    forMe: open.filter((a) => !viewerId || a.assigneeId === viewerId),
    byMe: viewerId
      ? open.filter((a) => a.assignerId === viewerId && a.assigneeId !== viewerId)
      : [],
    forms: data.forms,
    threads: data.threads.filter((t) => !t.resolved),
  };
}

/** The sidebar's Inbox count: the actions and cards assigned to the person; nothing while unread. */
export function inboxCount(data: InboxData | null, viewerId: string | null): number | undefined {
  if (!data) return undefined;
  return inboxSections(data, viewerId).forMe.length;
}

/** Everything the Inbox lists: Home's pill, so "Inbox is clear" is never said over an open thread or new responses. */
export function inboxTotal(data: InboxData | null, viewerId: string | null): number | undefined {
  if (!data) return undefined;
  const s = inboxSections(data, viewerId);
  return s.forMe.length + s.byMe.length + s.forms.length + s.threads.length;
}

// ---------- Why a row is here ----------------------------------------------------------------------------------

/** Why a row is in the Inbox, as its status says it (an icon and these words): the work handed to or by the
 *  person, a thread's reason, or a form's new responses. */
export type InboxReason =
  | { kind: 'assigned'; label: 'To do' }
  | { kind: 'waiting'; label: string }
  | { kind: 'mention'; label: 'Mentioned you' }
  | { kind: 'yours'; label: string }
  | { kind: 'replied'; label: 'Replied to you' | 'You replied' }
  | { kind: 'responses'; label: string };

/** Why a thread is on the page: a mention is the most direct reason, so it wins; then the item being theirs, until
 *  they reply; then that they are in it: someone else wrote last (Replied to you), or they did (You replied). Null
 *  for a thread the index lists for none of these. */
export function threadReason(
  t: Pick<InboxThread, 'app' | 'mentionsYou' | 'onYourItem' | 'youCommented'> & {
    latestAuthorId?: string | null;
  },
  viewerId: string | null = null,
): InboxReason | null {
  if (t.mentionsYou) return { kind: 'mention', label: 'Mentioned you' };
  if (t.onYourItem && !t.youCommented) {
    return { kind: 'yours', label: `On your ${kindWords(t.app).lowerOne}` };
  }
  if (!t.youCommented) return null;
  const someoneElse = Boolean(t.latestAuthorId && viewerId && t.latestAuthorId !== viewerId);
  return { kind: 'replied', label: someoneElse ? 'Replied to you' : 'You replied' };
}

/** A person's first name, for a status that must stay short ("Waiting on Bo"). */
export const firstName = (name: string | null | undefined): string | null =>
  name?.trim().split(/\s+/)[0] || null;

/** An action or card's reason: theirs to do, or waiting on whoever they handed it to. */
export function actionReason(a: Pick<InboxAction, 'assigneeName'>, forMe: boolean): InboxReason {
  if (forMe) return { kind: 'assigned', label: 'To do' };
  return { kind: 'waiting', label: `Waiting on ${firstName(a.assigneeName) ?? 'a teammate'}` };
}

/** A form's reason: how many responses the person hasn't seen. */
export const formReason = (unseen: number): InboxReason => ({
  kind: 'responses',
  label: `${unseen} new ${unseen === 1 ? 'response' : 'responses'}`,
});

// ---------- One list, newest first, with filters ---------------------------------------------------------------
//
// Each entry carries what the row, the reading pane, the filters and the keyboard need, worked out once per read
// rather than per render.

/** What a row is, as the telemetry names it (`Activity·Selected`). */
export type InboxEntryKind = 'Action' | 'Card' | 'Thread' | 'CardThread' | 'FormResponses';

export type InboxActionEntry = {
  key: string;
  kind: 'Action' | 'Card';
  /** Theirs to do (My Actions), or handed out by them (Assigned by Me). */
  forMe: boolean;
  row: Located<InboxAction>;
  at: number;
};
export type InboxThreadEntry = {
  key: string;
  kind: 'Thread' | 'CardThread';
  forMe: false;
  row: Located<InboxThread>;
  at: number;
};
export type InboxFormEntry = {
  key: string;
  kind: 'FormResponses';
  forMe: false;
  row: InboxForm;
  at: number;
};
export type InboxEntry = InboxActionEntry | InboxThreadEntry | InboxFormEntry;

/** The filter bar's choices. `mine`: assigned to me; `waiting`: assigned by me; `comments`: threads (mentions, on my
 *  items, replies); `forms`: forms with new responses. */
export const INBOX_FILTERS = ['all', 'mine', 'waiting', 'comments', 'forms'] as const;
export type InboxFilter = (typeof INBOX_FILTERS)[number];

export const INBOX_FILTER_LABEL: Record<InboxFilter, string> = {
  all: 'All',
  mine: 'My Actions',
  waiting: 'Assigned by Me',
  comments: 'Comments',
  forms: 'Form Responses',
};

/** The token a filter change reports (`Activity·Changed`). */
export const INBOX_FILTER_TELEMETRY: Record<InboxFilter, string> = {
  all: 'All',
  mine: 'MyActions',
  waiting: 'AssignedByMe',
  comments: 'Comments',
  forms: 'FormResponses',
};

export function isInboxFilter(v: unknown): v is InboxFilter {
  return typeof v === 'string' && (INBOX_FILTERS as readonly string[]).includes(v);
}

export function entryFilter(e: InboxEntry): Exclude<InboxFilter, 'all'> {
  switch (e.kind) {
    case 'Action':
    case 'Card':
      return e.forMe ? 'mine' : 'waiting';
    case 'Thread':
    case 'CardThread':
      return 'comments';
    case 'FormResponses':
      return 'forms';
  }
}

/** Every row, newest first: one pass to build, one sort. Keys are unique per row and stable across reads. */
export function inboxEntries(s: InboxSections): InboxEntry[] {
  const out: InboxEntry[] = [];
  const action = (r: Located<InboxAction>, forMe: boolean) =>
    out.push({
      key: `a:${r.app}:${r.itemId}:${r.actionId}`,
      kind: r.card ? 'Card' : 'Action',
      forMe,
      row: r,
      at: r.updatedAt,
    });
  for (const r of s.forMe) action(r, true);
  for (const r of s.byMe) action(r, false);
  // A card thread shared between two plans reaches the reader through both: one row, the newer (its element is the
  // thread's own id, unique across every item).
  const cardThreads = new Map<string, number>();
  for (const r of s.threads) {
    if (r.card?.id) {
      const key = `${r.app}:${r.elementId}`;
      const at = cardThreads.get(key);
      if (at !== undefined) {
        const held = out[at] as InboxThreadEntry;
        if (held.at < r.latestAt)
          out[at] = {
            ...held,
            key: `t:${r.app}:${r.itemId}:${r.tabId}:${r.elementId}`,
            row: r,
            at: r.latestAt,
          };
        continue;
      }
      cardThreads.set(key, out.length);
    }
    out.push({
      key: `t:${r.app}:${r.itemId}:${r.tabId}:${r.elementId}`,
      kind: r.card ? 'CardThread' : 'Thread',
      forMe: false,
      row: r,
      at: r.latestAt,
    });
  }
  for (const r of s.forms) {
    out.push({
      key: `f:${r.app}:${r.itemId}:${r.tabId}`,
      kind: 'FormResponses',
      forMe: false,
      row: r,
      at: r.latestAt,
    });
  }
  return out.sort((a, b) => b.at - a.at);
}

/** How many rows each filter holds, in one pass. */
export function inboxFilterCounts(entries: readonly InboxEntry[]): Record<InboxFilter, number> {
  const c: Record<InboxFilter, number> = {
    all: entries.length,
    mine: 0,
    waiting: 0,
    comments: 0,
    forms: 0,
  };
  for (const e of entries) c[entryFilter(e)]++;
  return c;
}

export function filterEntries(
  entries: readonly InboxEntry[],
  f: InboxFilter,
): readonly InboxEntry[] {
  return f === 'all' ? entries : entries.filter((e) => entryFilter(e) === f);
}

/** The date dividers: today (since local midnight), earlier this week (the six days before), older. */
export type InboxBucket = 'today' | 'week' | 'older';
export const INBOX_BUCKET_LABEL: Record<InboxBucket, string> = {
  today: 'Today',
  week: 'Earlier This Week',
  older: 'Older',
};

export function bucketEdges(now: number): { today: number; week: number } {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const today = d.getTime();
  d.setDate(d.getDate() - 6);
  return { today, week: d.getTime() };
}

export function bucketOf(at: number, edges: { today: number; week: number }): InboxBucket {
  return at >= edges.today ? 'today' : at >= edges.week ? 'week' : 'older';
}
