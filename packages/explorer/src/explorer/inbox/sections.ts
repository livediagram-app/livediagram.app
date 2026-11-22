// The Inbox's model (one-explorer-contracts.md "Inbox"): what the index and the host's Offline rows hold, split
// by whose move it is (assigned to the person, assigned by them, form responses, open threads), then laid out as one
// list, newest first, under date dividers, with a filter bar over it. The sidebar's count is the work waiting on the
// person: what is assigned to them, and the threads that ask something of them (a mention, a thread on their item
// they have not written in themselves), Offline's rows included. At 0 the sidebar and the rail show no badge;
// forms, threads they replied in and work they handed out are listed but not counted. An access request on an item
// they manage (request-access.md "In the Inbox") asks something of them, so it counts, as does an agent's suggested
// edit waiting on a page of theirs (one-explorer-contracts.md "Inbox", "Suggested edits"). An update on a page they
// watch (liveknowledge's Watching) asks nothing: it is listed under its own filter and never counted.

import type {
  InboxAccessRequest,
  InboxAction,
  InboxForm,
  InboxSuggestion,
  InboxThread,
  InboxUpdate,
  UpdateKind,
} from '@liveworkspace/index-client';
import type { Located } from '../../types';

export {
  inboxBadge,
  inboxCount,
  inboxSections,
  inboxTotal,
  threadNeedsYou,
  threadReason,
  type InboxReason,
  type InboxSections,
} from './inbox-count';
import type { InboxReason, InboxSections } from './inbox-count';

// ---------- Why a row is here ----------------------------------------------------------------------------------

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

/** A suggested edit's reason. */
export const SUGGESTION_REASON: InboxReason = { kind: 'suggestion', label: 'Suggested an edit' };
/** Each update kind's word, as a row's status says it. */
export const UPDATE_KIND_LABEL: Record<UpdateKind, string> = {
  saved: 'Edited',
  review_due: 'Verification Lapsed',
  approved: 'Approved',
  rejected: 'Rejected',
  moved: 'Moved',
  deleted: 'Deleted',
};

/** An update's reason: its first kind's word, and "+N" for the others ("Edited +1"). */
export function updateReason(u: Pick<InboxUpdate, 'kinds'>): InboxReason {
  const [first, ...rest] = u.kinds;
  const word = first ? UPDATE_KIND_LABEL[first] : 'Changed';
  return { kind: 'update', label: rest.length > 0 ? `${word} +${rest.length}` : word };
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
export type InboxEntryKind =
  | 'Action'
  | 'Card'
  | 'Thread'
  | 'CardThread'
  | 'FormResponses'
  | 'AccessRequest'
  | 'Suggestion'
  | 'Update';

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
export type InboxSuggestionEntry = {
  key: string;
  kind: 'Suggestion';
  forMe: false;
  row: InboxSuggestion;
  at: number;
};
export type InboxUpdateEntry = {
  key: string;
  kind: 'Update';
  forMe: false;
  row: InboxUpdate;
  at: number;
};
export type InboxEntry =
  | InboxActionEntry
  | InboxThreadEntry
  | InboxFormEntry
  | InboxAccessEntry
  | InboxSuggestionEntry
  | InboxUpdateEntry;

/** The filter bar's choices. `mine`: assigned to me; `waiting`: assigned by me; `comments`: threads (mentions, on my
 *  items, replies); `forms`: forms with new responses; `requests`: access requests on items I manage; `suggestions`:
 *  suggested edits waiting on my pages; `updates`: changes to pages I watch. The last three are offered only while
 *  there is one (or it is the choice: `shownFilters`). */
export const INBOX_FILTERS = [
  'all',
  'mine',
  'waiting',
  'comments',
  'forms',
  'requests',
  'suggestions',
  'updates',
] as const;
export type InboxFilter = (typeof INBOX_FILTERS)[number];

export const INBOX_FILTER_LABEL: Record<InboxFilter, string> = {
  all: 'All',
  mine: 'My Actions',
  waiting: 'Assigned by Me',
  comments: 'Comments',
  forms: 'Form Responses',
  requests: 'Access Requests',
  suggestions: 'Suggested Edits',
  updates: 'Updates',
};

/** The token a filter change reports (`Activity·Changed`). */
export const INBOX_FILTER_TELEMETRY: Record<InboxFilter, string> = {
  all: 'All',
  mine: 'MyActions',
  waiting: 'AssignedByMe',
  comments: 'Comments',
  forms: 'FormResponses',
  requests: 'AccessRequests',
  suggestions: 'SuggestedEdits',
  updates: 'Updates',
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
    case 'Suggestion':
      return 'suggestions';
    case 'Update':
      return 'updates';
  }
}

// The filters offered only while they hold a row (or are the choice).
const WHILE_LISTED: readonly InboxFilter[] = ['requests', 'suggestions', 'updates'];

/** The filters the dropdown offers: Access Requests, Suggested Edits and Updates only while there is one or it is the
 *  choice, so someone who never shares, has no agent suggesting edits, or never watches a page, never sees them. */
export function shownFilters(
  counts: Record<InboxFilter, number>,
  chosen: InboxFilter,
): readonly InboxFilter[] {
  return INBOX_FILTERS.filter((f) => !WHILE_LISTED.includes(f) || counts[f] > 0 || chosen === f);
}

export {
  actionKey,
  formKey,
  requestKey,
  settledOf,
  suggestionKey,
  threadKey,
  updateKey,
  withoutSettled,
  type InboxSettled,
} from './inbox-keys';
import { actionKey, formKey, requestKey, suggestionKey, threadKey, updateKey } from './inbox-keys';

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
  for (const r of s.suggestions) {
    out.push({
      key: suggestionKey(r),
      kind: 'Suggestion',
      forMe: false,
      row: r,
      at: r.createdAt,
    });
  }
  for (const r of s.updates) {
    out.push({ key: updateKey(r), kind: 'Update', forMe: false, row: r, at: r.latestAt });
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
    suggestions: 0,
    updates: 0,
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
