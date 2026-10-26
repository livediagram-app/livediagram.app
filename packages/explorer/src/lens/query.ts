// A lens as the index's list filters (one-explorer-contracts.md "The lens's filters"): the words, Made by AI, the
// widest Edited cutoff, People, Template's families, Mode's modes and, on an aggregate view, Space. The index narrows the list
// and pages what is left, so a lens reaches every item however long the list.

import type { ItemFilters } from '@liveworkspace/index-client';
import { appOfKind } from './dimensions';
import { editedSince } from './match';
import type { Lens, LensView } from './types';

export function lensFilters(lens: Lens, view: LensView, now: number): ItemFilters {
  const { filters } = lens;
  const out: ItemFilters = {};
  if (filters['opens-in'].length > 0) out.apps = filters['opens-in'].map(appOfKind);
  if (lens.text.length > 0) out.q = lens.text.join(' ');
  if (filters['made-by'].length > 0) out.source = ['ai'];
  const since = editedSince(filters.edited, now);
  if (since !== null) out.since = since;
  // Both People values together admit everyone.
  if (filters.people.length === 1) out.owner = filters.people[0];
  if (filters.template.length > 0) out.intent = filters.template;
  if (filters.mode.length > 0) out.modes = filters.mode;
  if (view === 'aggregate' && filters.space.length > 0) out.space = filters.space;
  return out;
}

/** A stable key for the filters a list was read with: a new key reads the list again from its first page. The
 *  Edited cutoff is in it to the minute, so a list is not read again on every keystroke's clock. */
export function filtersKey(filters: ItemFilters): string {
  const since = filters.since === undefined ? '' : String(Math.floor(filters.since / 60_000));
  return JSON.stringify([
    filters.apps ?? [],
    filters.q ?? '',
    filters.source ?? [],
    since,
    filters.owner ?? '',
    filters.intent ?? [],
    filters.modes ?? [],
    filters.space ?? [],
  ]);
}
