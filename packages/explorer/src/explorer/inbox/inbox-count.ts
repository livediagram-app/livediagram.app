// The Inbox's count and its sections (one-explorer-contracts.md "Inbox"; inbox-notices.md "The count"): what the
// sidebar's badge, the rail's and Home's pill read. Kept apart from the Inbox's list model (sections.ts, which
// re-exports these) so the Explorer's first load carries the count alone, not the list, its filters and its words
// (site.md "Performance and limits").

import type {
  App,
  InboxAccessRequest,
  InboxAction,
  InboxForm,
  InboxSuggestion,
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
  suggestions: InboxSuggestion[];
};

const NONE: InboxSections = {
  forMe: [],
  byMe: [],
  forms: [],
  threads: [],
  requests: [],
  suggestions: [],
};

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
    suggestions: data.suggestions ?? [],
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
    ...(data.suggestions ? { suggestions: of(data.suggestions) } : {}),
  };
}

/** The sidebar's Inbox count: the actions and cards assigned to the person, the threads that ask something of
 *  them, the access requests they answer and the suggested edits waiting on their pages; nothing while unread. Drawn as a badge only above 0 (`inboxBadge`). With `app`, only that app's rows: an
 *  editor's count (its menu button and its panel's rail) is its own app's (inbox-notices.md "The count"). */
export function inboxCount(
  data: InboxData | null,
  viewerId: string | null,
  app: App | null = null,
): number | undefined {
  if (!data) return undefined;
  const s = inboxSections(countedRows(data, app), viewerId);
  let n = s.forMe.length + s.requests.length + s.suggestions.length;
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
  // Every section's rows: each is a list.
  return Object.values(inboxSections(data, viewerId)).reduce((n, rows) => n + rows.length, 0);
}

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
  | { kind: 'access'; label: 'Wants access' }
  | { kind: 'suggestion'; label: 'Suggested an edit' };

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
