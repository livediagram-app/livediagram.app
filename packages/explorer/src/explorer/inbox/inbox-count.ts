// The Inbox's count and its sections (one-explorer-contracts.md "Inbox"; inbox-notices.md "The count"): what the
// sidebar's badge, the rail's and Home's pill read. Kept apart from the Inbox's list model (sections.ts, which
// re-exports these) so the Explorer's first load carries the count alone, not the list, its filters and its words
// (site.md "Performance and limits").

import {
  actionKey,
  isInboxRowUnread,
  requestKey,
  suggestionKey,
  threadKey,
} from '@liveworkspace/index-client';
import type {
  InboxAccessRequest,
  InboxAction,
  InboxForm,
  InboxSuggestion,
  InboxThread,
  InboxAutomationNotice,
  InboxCallInvite,
  InboxUpdate,
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
  updates: InboxUpdate[];
  // Invites to calls about items (item-calls.md "Invites"): listed under Calls, never counted.
  calls: InboxCallInvite[];
  // A rule's Notify steps to the person (automations.md): listed under Automations, never counted.
  notices: InboxAutomationNotice[];
};

const NONE: InboxSections = {
  forMe: [],
  byMe: [],
  forms: [],
  threads: [],
  requests: [],
  suggestions: [],
  updates: [],
  calls: [],
  notices: [],
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
    updates: data.updates ?? [],
    calls: data.calls ?? [],
    notices: data.notices ?? [],
  };
}

/** A thread asks something of the person: they are mentioned, or it is on their item and they have not written in
 *  it themselves (an agent's question with their token included). The row's semibold and the badge agree on it. */
export const threadNeedsYou = (reason: InboxReason | null): boolean =>
  reason?.kind === 'mention' || reason?.kind === 'yours' || reason?.kind === 'ask';

/** The sidebar's Inbox count: the actions and cards assigned to the person, the threads that ask something of
 *  them (an agent's ask too), the access requests they answer and the suggested edits waiting on their pages, each
 *  while it is unread (inbox-reading.md "Read and unread"); nothing while the Inbox is not read yet. Drawn as a badge only above 0 (`inboxBadge`). Every app's rows, as the Inbox lists them: the
 *  page's sidebar, the panel's rail and the editor's menu button count the same (inbox-notices.md "The count"). */
export function inboxCount(data: InboxData | null, viewerId: string | null): number | undefined {
  if (!data) return undefined;
  const s = inboxSections(data, viewerId);
  const read = data.read;
  const unread = (key: string, at: number) => isInboxRowUnread(key, at, read);
  let n = 0;
  for (const a of s.forMe) if (unread(actionKey(a), a.updatedAt)) n++;
  for (const r of s.requests) if (unread(requestKey(r), r.askedAt)) n++;
  for (const r of s.suggestions) if (unread(suggestionKey(r), r.createdAt)) n++;
  for (const t of s.threads) {
    if (threadNeedsYou(threadReason(t, viewerId)) && unread(threadKey(t), t.latestAt)) n++;
  }
  return n;
}

/** The sidebar's and the rail's Inbox badge: the count, or nothing at 0 and while unread, so an Inbox with nothing
 *  waiting shows no "0" pill. */
export function inboxBadge(data: InboxData | null, viewerId: string | null): number | undefined {
  return inboxCount(data, viewerId) || undefined;
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
  | { kind: 'ask'; label: 'Needs your response' }
  | { kind: 'responses'; label: string }
  | { kind: 'access'; label: 'Wants access' }
  | { kind: 'suggestion'; label: 'Suggested an edit' }
  | { kind: 'update'; label: string }
  | { kind: 'call'; label: 'Invited you to a call' }
  | { kind: 'automation'; label: 'Automation' };

/** Why a thread is on the page: an agent's open ask first (it names what is wanted); then a mention, the most direct
 *  reason; then the item being theirs, until
 *  they reply themselves; then that they are in it: someone else wrote last (Replied to you), or they did (You
 *  replied). A thread the index lists for none of these reaches them only through their agent (its comments posted
 *  with their token, `agentIds`): Your agent wrote. An offline row always has a reason. */
export function threadReason(
  t: Pick<InboxThread, 'app' | 'mentionsYou' | 'onYourItem' | 'youCommented'> & {
    latestAuthorId?: string | null;
    asks?: boolean;
  },
  viewerId: string | null = null,
): InboxReason {
  // An agent asked the thread's people to respond, and nobody has since (inbox-reading.md "AI comments").
  if (t.asks) return { kind: 'ask', label: 'Needs your response' };
  if (t.mentionsYou) return { kind: 'mention', label: 'Mentioned you' };
  if (t.onYourItem && !t.youCommented) {
    return { kind: 'yours', label: `On your ${kindWords(t.app).lowerOne}` };
  }
  if (!t.youCommented) return { kind: 'agent', label: 'Your agent wrote' };
  const someoneElse = Boolean(t.latestAuthorId && viewerId && t.latestAuthorId !== viewerId);
  return { kind: 'replied', label: someoneElse ? 'Replied to you' : 'You replied' };
}
