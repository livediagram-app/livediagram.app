// Narrowing rows by a lens on this side (explorer-filters.md "Matching"). The index narrows the lists themselves
// (query.ts); this keeps a row the person just changed honest (renamed, moved, shared) until the list is read
// again, and tells the suggestions which values match nothing in a list loaded whole.

import { APP_KINDS, type Item } from '@liveworkspace/index-client';
import type { EditedValue } from './dimensions';
import type { Lens, LensSubject } from './types';

const DAY_MS = 86_400_000;

/** The last word of a creation intent: "plan:board:kanban" → "kanban". */
export function intentWord(intent: string | null): string | null {
  if (!intent) return null;
  const at = intent.lastIndexOf(':');
  return at === -1 ? intent : intent.slice(at + 1);
}

/** An index item as the reader sees it: theirs, their team's, or reached through a link. */
export function itemSubject(
  item: Pick<
    Item,
    'app' | 'title' | 'updatedAt' | 'ownerId' | 'teamId' | 'source' | 'intent' | 'sharedVia'
  >,
  viewerId: string | null,
): LensSubject {
  return {
    name: item.title,
    opensIn: APP_KINDS[item.app],
    savedAt: item.updatedAt,
    space: item.sharedVia ? 'shared' : item.teamId ? `team:${item.teamId}` : 'mine',
    people: viewerId !== null && item.ownerId === viewerId ? 'me' : 'others',
    madeByAi: item.source === 'ai',
    template: intentWord(item.intent),
  };
}

/** Lower case with accents stripped, so "Café" and "cafe" compare equal. */
export function foldText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** The earliest save an Edited value includes, from `now` in local time. */
export function editedCutoff(value: EditedValue, now: number): number {
  const date = new Date(now);
  switch (value) {
    case 'today':
      return date.setHours(0, 0, 0, 0);
    case '7d':
      return now - 7 * DAY_MS;
    case '30d':
      return now - 30 * DAY_MS;
    case '12m':
      return date.setFullYear(date.getFullYear() - 1);
    case 'this-year':
      return new Date(date.getFullYear(), 0, 1).getTime();
  }
}

/** The earliest save the Edited values include together (they or-combine: the widest wins), or null. */
export function editedSince(values: readonly EditedValue[], now: number): number | null {
  if (values.length === 0) return null;
  return Math.min(...values.map((value) => editedCutoff(value, now)));
}

/** Whether a set of values admits a subject's value: an unset dimension admits anything, a set one only its own
 *  values, and never an unknown. */
function admits<T>(values: readonly T[], value: T | null): boolean {
  return values.length === 0 || (value !== null && values.includes(value));
}

/**
 * Compiles a lens once into a predicate. Values of one dimension combine with or; dimensions with and. With
 * `text: false` the words are left out: the index matches them against folder names too, which a row cannot say.
 */
export function compileLens(
  lens: Lens,
  now: number,
  { text = true }: { text?: boolean } = {},
): (subject: LensSubject) => boolean {
  const { filters } = lens;
  const words = text ? lens.text.map(foldText) : [];
  const cutoff = editedSince(filters.edited, now);
  return (subject) =>
    admits(filters['opens-in'], subject.opensIn) &&
    admits(filters.template, subject.template) &&
    (filters['made-by'].length === 0 || subject.madeByAi === true) &&
    (cutoff === null || subject.savedAt >= cutoff) &&
    admits(filters.people, subject.people) &&
    admits(filters.space, subject.space) &&
    words.every((word) => foldText(subject.name).includes(word));
}
