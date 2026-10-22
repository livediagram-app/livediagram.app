// A whole tab was deleted (docs/specs/013-workspace/timeline.md §4.3): every comment it held leaves
// the feed, as a single deleted comment does. Built on `retractComments`, so the events go only from
// the document the tab left: a tab still linked into another document keeps that document's events,
// because each event is pinned to its document.

import type { Element } from '@livepages/document';
import type { Env } from '../types';
import { retractComments } from './document-events';
import { removedComments } from './tab-diff';

// The comments of a deleted tab, from its stored body (the tabs row's `data`), as a save that
// dropped every element would see them. A body that does not parse retracts nothing, logged.
export async function retractTabComments(
  env: Env,
  documentId: string,
  data: string,
): Promise<void> {
  let elements: Element[];
  try {
    const parsed = JSON.parse(data) as { elements?: unknown };
    elements = Array.isArray(parsed.elements) ? (parsed.elements as Element[]) : [];
  } catch (err) {
    console.error('timeline tab comment retract skipped: unreadable tab body', documentId, err);
    return;
  }
  await retractComments(
    env,
    documentId,
    removedComments([], elements).map((c) => ({
      id: c.id,
      threadKey: c.opening ? `${documentId}:${c.elementId}` : null,
    })),
  );
}
