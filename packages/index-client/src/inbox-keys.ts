// Each Inbox row's key (liveworkspace/docs/specs/004-index/inbox-reading.md "Read and unread"): unique per row and
// stable across reads. One copy for the Explorer's list and the index's read state, so a row read in one app reads
// as read in every other.

import type { InboxAccessRequest } from './access-requests';
import type { InboxCallInvite } from './item-calls';
import type {
  InboxAction,
  InboxAutomationNotice,
  InboxForm,
  InboxResponse,
  InboxSuggestion,
  InboxThread,
} from './types';
import type { InboxUpdate } from './updates';

/** The longest row key the index keeps read state for. */
export const INBOX_ROW_KEY_MAX = 300;
/** The most rows one `PUT /inbox/read` reads, and the most it marks unread. */
export const INBOX_READ_BATCH_MAX = 200;
/** The most read entries the index keeps per person (the newest). */
export const INBOX_READS_MAX = 1_000;

export const actionKey = (r: Pick<InboxAction, 'app' | 'itemId' | 'actionId'>) =>
  `a:${r.app}:${r.itemId}:${r.actionId}`;
export const threadKey = (r: Pick<InboxThread, 'app' | 'itemId' | 'tabId' | 'elementId'>) =>
  `t:${r.app}:${r.itemId}:${r.tabId}:${r.elementId}`;
export const formKey = (r: Pick<InboxForm, 'app' | 'itemId' | 'tabId'>) =>
  `f:${r.app}:${r.itemId}:${r.tabId}`;
/** An access request's: `r:<id>`, the key its notice and its email open the Inbox at (`?at=`). */
export const requestKey = (r: Pick<InboxAccessRequest, 'id'>) => `r:${r.id}`;
/** A suggested edit's: its app, item, page and id. */
export const suggestionKey = (
  r: Pick<InboxSuggestion, 'app' | 'itemId' | 'tabId' | 'suggestionId'>,
) => `g:${r.app}:${r.itemId}:${r.tabId}:${r.suggestionId}`;
/** A call invite's: its id, the key its notice opens the Inbox at. */
export const callKey = (r: Pick<InboxCallInvite, 'id'>) => `k:${r.id}`;
/** A rule's notice's: its id, the key its notice opens the Inbox at. */
export const noticeKey = (r: Pick<InboxAutomationNotice, 'id'>) => `n:${r.id}`;
/** An update's: its app, item and id, the key its notice opens the Inbox at. */
export const updateKey = (r: Pick<InboxUpdate, 'app' | 'itemId' | 'id'>) =>
  `u:${r.app}:${r.itemId}:${r.id}`;

/** Every row key an Inbox answer lists (the shares, which no row draws, aside). */
export function inboxRowKeys(r: Omit<InboxResponse, 'read'>): string[] {
  return [
    ...r.threads.map(threadKey),
    ...r.actions.map(actionKey),
    ...r.forms.map(formKey),
    ...(r.accessRequests ?? []).map(requestKey),
    ...(r.suggestions ?? []).map(suggestionKey),
    ...(r.updates ?? []).map(updateKey),
    ...(r.calls ?? []).map(callKey),
    ...(r.notices ?? []).map(noticeKey),
  ];
}

/** Whether a row whose time is `at` is unread, by its key, as the index's read state says. No state: unread. */
export function isInboxRowUnread(
  key: string,
  at: number,
  read: { before: number; at: Readonly<Record<string, number>> } | null | undefined,
): boolean {
  if (!read) return true;
  const readAt = Object.hasOwn(read.at, key) ? read.at[key] : undefined;
  return readAt !== undefined ? readAt < at : read.before < at;
}
