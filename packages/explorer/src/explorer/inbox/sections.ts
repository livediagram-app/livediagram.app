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

/** Why a row is in the Inbox, as its chip says it: the work handed to or by the person, a thread's reason, or a
 *  form's new responses. */
export type InboxReason =
  | { kind: 'assigned'; label: 'Assigned to you' }
  | { kind: 'waiting'; label: string }
  | { kind: 'mention'; label: 'Mentioned you' }
  | { kind: 'yours'; label: string }
  | { kind: 'replied'; label: 'You replied' }
  | { kind: 'responses'; label: string };

/** Why a thread is on the page: a mention is the most direct reason, so it wins; then the item being theirs, until
 *  they reply; then that they replied. Null for a thread the index lists for none of these. */
export function threadReason(
  t: Pick<InboxThread, 'app' | 'mentionsYou' | 'onYourItem' | 'youCommented'>,
): InboxReason | null {
  if (t.mentionsYou) return { kind: 'mention', label: 'Mentioned you' };
  if (t.onYourItem && !t.youCommented) {
    return { kind: 'yours', label: `On your ${kindWords(t.app).lowerOne}` };
  }
  return t.youCommented ? { kind: 'replied', label: 'You replied' } : null;
}

/** An action or card's reason: theirs to do, or waiting on whoever they handed it to. */
export function actionReason(a: Pick<InboxAction, 'assigneeName'>, forMe: boolean): InboxReason {
  if (forMe) return { kind: 'assigned', label: 'Assigned to you' };
  return { kind: 'waiting', label: `Waiting on ${a.assigneeName?.trim() || 'a teammate'}` };
}

/** A form's reason: how many responses the person hasn't seen. */
export const formReason = (unseen: number): InboxReason => ({
  kind: 'responses',
  label: `${unseen} new ${unseen === 1 ? 'response' : 'responses'}`,
});

/** Everything the Inbox lists: Home's pill, so "Inbox is clear" is never said over an open thread or new responses. */
export function inboxTotal(data: InboxData | null, viewerId: string | null): number | undefined {
  if (!data) return undefined;
  const s = inboxSections(data, viewerId);
  return s.forMe.length + s.byMe.length + s.forms.length + s.threads.length;
}
