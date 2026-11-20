// The Inbox's model (one-explorer-contracts.md "Inbox"): what the index and the host's Offline rows hold, split
// by whose move it is (assigned to the person, assigned by them, form responses, open threads), then laid out as one
// list, newest first, under date dividers, with a filter bar over it. The sidebar's count is the work waiting on the
// person: what is assigned to them, and the threads that ask something of them (a mention, a thread on their item
// they have not written in themselves), Offline's rows included. At 0 the sidebar and the rail show no badge;
// forms, threads they replied in and work they handed out are listed but not counted. An access request on an item
// they manage (request-access.md "In the Inbox") asks something of them, so it counts.

import type {
  App,
  InboxAccessRequest,
  InboxAction,
  InboxForm,
  InboxThread,
} from '@liveworkspace/index-client';
import type { Located } from '../../types';
import type { InboxData } from '../../data/useInbox';
import { kindWords } from '../../words';

export type InboxSections = {
  forMe: Located<InboxAction>[];
  byMe: Located<InboxAction>[];
  forms: InboxForm[];
  threads: Located<InboxThread>[];
  requests: InboxAccessRequest[];
};

const NONE: InboxSections = { forMe: [], byMe: [], forms: [], threads: [], requests: [] };

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
    // The reader's own request (a team member who once could not reach a team item) is never theirs to answer.
    requests: (data.accessRequests ?? []).filter((r) => !viewerId || r.requesterId !== viewerId),
  };
}

/** A thread asks something of the person: they are mentioned, or it is on their item and they have not written in
 *  it themselves (an agent's question with their token included). The row's semibold and the badge agree on it. */
export const threadNeedsYou = (reason: InboxReason | null): boolean =>
  reason?.kind === 'mention' || reason?.kind === 'yours';

/** The rows the count reads, of one app only: every row names its app (an access request its item's, a card thread
 *  the plan's that lists it, an Offline row the host's), as the index's `?app=` reads them, so none is lost. */
function countedRows(data: InboxData, app: App | null): InboxData {
  if (!app) return data;
  const of = <T extends { app: App }>(rows: T[]) => rows.filter((r) => r.app === app);
  return {
    ...data,
    actions: of(data.actions),
    threads: of(data.threads),
    ...(data.accessRequests ? { accessRequests: of(data.accessRequests) } : {}),
  };
}

/** The sidebar's Inbox count: the actions and cards assigned to the person, and the threads that ask something of
 *  them; nothing while unread. Drawn as a badge only above 0 (`inboxBadge`). With `app`, only that app's rows: an
 *  editor's count (its menu button and its panel's rail) is its own app's (inbox-notices.md "The count"). */
export function inboxCount(
  data: InboxData | null,
  viewerId: string | null,
  app: App | null = null,
): number | undefined {
  if (!data) return undefined;
  const s = inboxSections(countedRows(data, app), viewerId);
  let n = s.forMe.length + s.requests.length;
  for (const t of s.threads) if (threadNeedsYou(threadReason(t, viewerId))) n++;
  return n;
}

/** The sidebar's and the rail's Inbox badge: the count, or nothing at 0 and while unread, so an Inbox with nothing
 *  waiting shows no "0" pill. */
export function inboxBadge(
  data: InboxData | null,
  viewerId: string | null,
  app: App | null = null,
): number | undefined {
  return inboxCount(data, viewerId, app) || undefined;
}

/** Everything the Inbox lists: Home's pill, so "Inbox is clear" is never said over an open thread or new responses. */
export function inboxTotal(data: InboxData | null, viewerId: string | null): number | undefined {
  if (!data) return undefined;
  const s = inboxSections(data, viewerId);
  return s.forMe.length + s.byMe.length + s.forms.length + s.threads.length + s.requests.length;
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
  | { kind: 'agent'; label: 'Your agent wrote' }
  | { kind: 'responses'; label: string }
  | { kind: 'access'; label: 'Wants access' };

/** Why a thread is on the page: a mention is the most direct reason, so it wins; then the item being theirs, until
 *  they reply themselves; then that they are in it: someone else wrote last (Replied to you), or they did (You
 *  replied). A thread the index lists for none of these reaches them only through their agent (its comments posted
 *  with their token, `agentIds`): Your agent wrote. An offline row always has a reason. */
export function threadReason(
  t: Pick<InboxThread, 'app' | 'mentionsYou' | 'onYourItem' | 'youCommented'> & {
    latestAuthorId?: string | null;
  },
  viewerId: string | null = null,
): InboxReason {
  if (t.mentionsYou) return { kind: 'mention', label: 'Mentioned you' };
  if (t.onYourItem && !t.youCommented) {
    return { kind: 'yours', label: `On your ${kindWords(t.app).lowerOne}` };
  }
  if (!t.youCommented) return { kind: 'agent', label: 'Your agent wrote' };
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

/** An access request's reason. */
export const ACCESS_REASON: InboxReason = { kind: 'access', label: 'Wants access' };

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
export type InboxEntryKind =
  'Action' | 'Card' | 'Thread' | 'CardThread' | 'FormResponses' | 'AccessRequest';

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
export type InboxAccessEntry = {
  key: string;
  kind: 'AccessRequest';
  forMe: false;
  row: InboxAccessRequest;
  at: number;
};
export type InboxEntry = InboxActionEntry | InboxThreadEntry | InboxFormEntry | InboxAccessEntry;

/** The filter bar's choices. `mine`: assigned to me; `waiting`: assigned by me; `comments`: threads (mentions, on my
 *  items, replies); `forms`: forms with new responses; `requests`: access requests on items I manage, offered only
 *  while there is one (or it is the choice: `shownFilters`). */
export const INBOX_FILTERS = ['all', 'mine', 'waiting', 'comments', 'forms', 'requests'] as const;
export type InboxFilter = (typeof INBOX_FILTERS)[number];

export const INBOX_FILTER_LABEL: Record<InboxFilter, string> = {
  all: 'All',
  mine: 'My Actions',
  waiting: 'Assigned by Me',
  comments: 'Comments',
  forms: 'Form Responses',
  requests: 'Access Requests',
};

/** The token a filter change reports (`Activity·Changed`). */
export const INBOX_FILTER_TELEMETRY: Record<InboxFilter, string> = {
  all: 'All',
  mine: 'MyActions',
  waiting: 'AssignedByMe',
  comments: 'Comments',
  forms: 'FormResponses',
  requests: 'AccessRequests',
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
    case 'AccessRequest':
      return 'requests';
  }
}

/** The filters the dropdown offers: Access Requests only while there is one or it is the choice, so someone who never
 *  shares never sees it. */
export function shownFilters(
  counts: Record<InboxFilter, number>,
  chosen: InboxFilter,
): readonly InboxFilter[] {
  return INBOX_FILTERS.filter(
    (f) => f !== 'requests' || counts.requests > 0 || chosen === 'requests',
  );
}

// Each row's key: unique per row and stable across reads.
export const actionKey = (r: Pick<InboxAction, 'app' | 'itemId' | 'actionId'>) =>
  `a:${r.app}:${r.itemId}:${r.actionId}`;
export const threadKey = (r: Pick<InboxThread, 'app' | 'itemId' | 'tabId' | 'elementId'>) =>
  `t:${r.app}:${r.itemId}:${r.tabId}:${r.elementId}`;
export const formKey = (r: Pick<InboxForm, 'app' | 'itemId' | 'tabId'>) =>
  `f:${r.app}:${r.itemId}:${r.tabId}`;
/** An access request's: `r:<id>`, the key its notice and its email open the Inbox at (`?at=`). */
export const requestKey = (r: Pick<InboxAccessRequest, 'id'>) => `r:${r.id}`;

/** What holds a row done from the pane out of the Inbox (`useInbox`'s `settle`): its key, a card thread by its own id
 *  (whichever plan lists it, as the list shows it once), and its time then, so a row that changes after comes back. */
export type InboxSettled = { key: string; at: number };
const threadSettleKey = (
  r: Pick<InboxThread, 'app' | 'itemId' | 'tabId' | 'elementId' | 'card'>,
) => (r.card?.id ? `c:${r.app}:${r.elementId}` : threadKey(r));
export function settledOf(e: InboxEntry): InboxSettled {
  switch (e.kind) {
    case 'Thread':
    case 'CardThread':
      return { key: threadSettleKey(e.row), at: e.row.latestAt };
    case 'Action':
    case 'Card':
      return { key: actionKey(e.row), at: e.row.updatedAt };
    case 'FormResponses':
      return { key: formKey(e.row), at: e.row.latestAt };
    case 'AccessRequest':
      return { key: requestKey(e.row), at: e.row.askedAt };
  }
}

/** The Inbox without the rows done from the pane while a read still lists them as they were. */
export function withoutSettled(data: InboxData, settled: ReadonlyMap<string, number>): InboxData {
  if (settled.size === 0) return data;
  const kept = (key: string, at: number) => settled.get(key) !== at;
  return {
    ...data,
    actions: data.actions.filter((a) => kept(actionKey(a), a.updatedAt)),
    threads: data.threads.filter((t) => kept(threadSettleKey(t), t.latestAt)),
    forms: data.forms.filter((f) => kept(formKey(f), f.latestAt)),
    ...(data.accessRequests
      ? { accessRequests: data.accessRequests.filter((r) => kept(requestKey(r), r.askedAt)) }
      : {}),
  };
}

/** Every row, newest first: one pass to build, one sort. */
export function inboxEntries(s: InboxSections): InboxEntry[] {
  const out: InboxEntry[] = [];
  const action = (r: Located<InboxAction>, forMe: boolean) =>
    out.push({
      key: actionKey(r),
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
            key: threadKey(r),
            row: r,
            at: r.latestAt,
          };
        continue;
      }
      cardThreads.set(key, out.length);
    }
    out.push({
      key: threadKey(r),
      kind: r.card ? 'CardThread' : 'Thread',
      forMe: false,
      row: r,
      at: r.latestAt,
    });
  }
  for (const r of s.forms) {
    out.push({
      key: formKey(r),
      kind: 'FormResponses',
      forMe: false,
      row: r,
      at: r.latestAt,
    });
  }
  for (const r of s.requests) {
    out.push({ key: requestKey(r), kind: 'AccessRequest', forMe: false, row: r, at: r.askedAt });
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
    requests: 0,
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
