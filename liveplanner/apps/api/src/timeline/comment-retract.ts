// A whole tab or a whole Plan card was deleted (docs/specs/013-workspace/timeline.md §4.3): every
// comment it held leaves the feed, as a single deleted comment does. Built on `retractComments`, so
// the events go only from the project the tab or card left: a tab still linked into another
// project keeps that project's events, because each event is pinned to its project.

import { itemThread, type Element } from '@liveplanner/project';
import type { Item } from '@liveplanner/items';
import type { Env } from '../types';
import { retractComments } from './project-events';
import { removedComments } from './tab-diff';

// The comments of a deleted tab, from its stored body (the tabs row's `data`), as a save that
// dropped every element would see them. A body that does not parse retracts nothing, logged.
export async function retractTabComments(
  env: Env,
  projectId: string,
  data: string,
): Promise<void> {
  let elements: Element[];
  try {
    const parsed = JSON.parse(data) as { elements?: unknown };
    elements = Array.isArray(parsed.elements) ? (parsed.elements as Element[]) : [];
  } catch (err) {
    console.error('timeline tab comment retract skipped: unreadable tab body', projectId, err);
    return;
  }
  await retractComments(
    env,
    projectId,
    removedComments([], elements).map((c) => ({
      id: c.id,
      threadKey: c.opening ? `${projectId}:${c.elementId}` : null,
    })),
  );
}

// The comments of a deleted card. The card's thread key matches item-comment-routes.ts.
export async function retractCardComments(
  env: Env,
  projectId: string,
  item: Pick<Item, 'id' | 'fields'>,
): Promise<void> {
  const comments = itemThread(item)?.comments ?? [];
  await retractComments(
    env,
    projectId,
    comments.map((c, i) => ({
      id: c.id,
      threadKey: i === 0 ? `${projectId}:item:${item.id}` : null,
    })),
  );
}
