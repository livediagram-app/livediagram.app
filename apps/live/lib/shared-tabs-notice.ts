// The shared-tab notice (docs/specs/006-document/tab-document-many-to-many.md,
// "Shared-tab notice"): the sentence the delete and Take Offline confirmations
// add when some of the diagram's tabs are also in other diagrams, so the user
// knows those tabs stay before they act.

import type { SharedTabsSummary } from '@livediagram/api-schema';
import { apiSharedTabs } from './api-client';

export type SharedTabsAction = 'delete' | 'offline';

// How long a confirmation waits for the counts before opening without them.
// One small indexed read; past this the dialog matters more than the sentence.
export const SHARED_TABS_NOTICE_TIMEOUT_MS = 1500;

export function sharedTabsNotice(
  { tabs, documents: liveDocs }: SharedTabsSummary,
  action: SharedTabsAction,
): string | null {
  if (tabs === 0) return null;
  const one = tabs === 1;
  // A non-breaking space keeps the count on the line with its noun.
  const where = `${tabs}\u00a0of its tabs ${one ? 'is' : 'are'} also used in ${liveDocs} other diagram${liveDocs === 1 ? '' : 's'}`;
  const stays = one ? 'it stays there' : 'they stay there';
  if (action === 'delete') return `${where}; ${stays}.`;
  const parting = one
    ? 'the copy in this browser no longer shares edits with it'
    : 'the copies in this browser no longer share edits with them';
  return `${where}; ${stays}, and ${parting}.`;
}

// Read the counts and word them; null when there is nothing to say, the
// diagram is offline, or the read failed or ran out of time. A failure is
// reported by the api client; the confirmation still opens, because the
// server keeps shared tabs whether or not the notice was shown.
export async function fetchSharedTabsNotice(
  ownerId: string,
  documentId: string,
  action: SharedTabsAction,
): Promise<string | null> {
  try {
    const summary = await apiSharedTabs(
      ownerId,
      documentId,
      AbortSignal.timeout(SHARED_TABS_NOTICE_TIMEOUT_MS),
    );
    return summary ? sharedTabsNotice(summary, action) : null;
  } catch {
    return null;
  }
}
