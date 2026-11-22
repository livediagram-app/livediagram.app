// The Inbox's row keys and the rows held done from the pane (`useInbox`'s `settle`): what the Inbox's data hook reads
// on every page, kept apart from the list model (sections.ts, which re-exports these) so the Explorer's first load
// does not carry the list, its filters and its words (site.md "Performance and limits").

import type {
  InboxAccessRequest,
  InboxAction,
  InboxForm,
  InboxSuggestion,
  InboxThread,
} from '@liveworkspace/index-client';
import type { InboxData } from '../../data/useInbox';
import type { InboxEntry } from './sections';

// Each row's key: unique per row and stable across reads.
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
    case 'Suggestion':
      return { key: suggestionKey(e.row), at: e.row.createdAt };
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
    ...(data.suggestions
      ? { suggestions: data.suggestions.filter((r) => kept(suggestionKey(r), r.createdAt)) }
      : {}),
  };
}
