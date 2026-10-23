// The Inbox's sections (one-explorer-contracts.md "Inbox"): Assigned to You (actions and cards on the person, a
// self-assignment only here), Assigned by You, Form Responses, and Open Comment Threads (an element's or a card's),
// each newest first. The sidebar's count is the work waiting on the person: Assigned to You, This Browser's rows
// included. It shows 0 once read, so an empty Inbox reads as done; forms, threads and work they handed out are not
// counted.

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

/** Why a thread is on the page: a mention is the most direct reason, so it wins; then the item being theirs, unless
 *  they have commented (then it is plainly a thread they are in). */
export function threadHint(
  t: Pick<InboxThread, 'app' | 'mentionsYou' | 'onYourItem' | 'youCommented'>,
): string | null {
  if (t.mentionsYou) return 'Mentioned You';
  return t.onYourItem && !t.youCommented ? `Your ${kindWords(t.app).lowerOne}` : null;
}

/** Everything the Inbox lists: Home's pill, so "Inbox is clear" is never said over an open thread or new responses. */
export function inboxTotal(data: InboxData | null, viewerId: string | null): number | undefined {
  if (!data) return undefined;
  const s = inboxSections(data, viewerId);
  return s.forMe.length + s.byMe.length + s.forms.length + s.threads.length;
}
