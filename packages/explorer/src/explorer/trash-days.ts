// The Trash's days and groups (TrashPane.tsx, the editor panel's TrashSection.tsx): plain helpers, kept apart from
// the Trash's view, which loads from its own chunk (lazy-panes.ts).

import type { ShownItem } from '../data/overlay';
import { DAY_MONTH } from '@liveworkspace/ui/date-format';
import type { Words } from '../words';
import { compareNames } from '../data/name-order';
import type { ShelfStat } from './ShelfIntro';

export const TRASH_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
// The last week: a row's meter turns amber, and the band counts it as leaving soon.
export const SOON_DAYS = 7;

type TrashGroup = { key: string; title: string; teamId: string | null; rows: ShownItem[] };

export function trashGroups(
  items: readonly ShownItem[],
  teamName: (id: string | null) => string | null,
  words: Words,
): TrashGroup[] {
  const mine: ShownItem[] = [];
  const teams = new Map<string, ShownItem[]>();
  // Pushed in place: a copy of the team's list per item made a big team Trash quadratic, on every render.
  for (const item of items) {
    if (!item.teamId) mine.push(item);
    else {
      const rows = teams.get(item.teamId);
      if (rows) rows.push(item);
      else teams.set(item.teamId, [item]);
    }
  }
  const groups: TrashGroup[] = [];
  if (mine.length > 0)
    groups.push({ key: 'mine', title: `Your ${words.lowerMany}`, teamId: null, rows: mine });
  const teamGroups = [...teams].map(([teamId, rows]) => ({
    key: `team:${teamId}`,
    title: teamName(teamId) ?? 'A team',
    teamId,
    rows,
  }));
  // By name as every list of names is (name-order.ts), so "Team 2" comes before "Team 10".
  teamGroups.sort((a, b) => compareNames(a.title, b.title));
  return [...groups, ...teamGroups];
}

/** "Deleted 3 Oct", or why an empty item was tidied away. */
export function trashedOnLabel(item: Pick<ShownItem, 'trashedAt' | 'trashReason'>): string {
  const on = DAY_MONTH.format(item.trashedAt ?? 0);
  return item.trashReason === 'empty' ? `Moved here ${on} because it was empty` : `Deleted ${on}`;
}

/** Whole days left before the daily clean-up removes it, never below 0. */
export function daysLeft(trashedAt: number, now: number): number {
  return Math.max(0, Math.ceil((trashedAt + TRASH_DAYS * DAY_MS - now) / DAY_MS));
}

export function daysLeftLabel(trashedAt: number, now: number): string {
  const days = daysLeft(trashedAt, now);
  if (days === 0) return 'Removed at the next clean-up';
  return days === 1 ? '1 day left' : `${days} days left`;
}

/** The band's figures: how many the Trash holds ("12+" while more pages wait) and how many leave within the week. */
export function trashStats(
  items: readonly Pick<ShownItem, 'trashedAt'>[],
  now: number,
  more: boolean,
  words: Words,
): ShelfStat[] {
  const n = items.length;
  const stats: ShelfStat[] = [
    {
      label: `${n.toLocaleString()}${more ? '+' : ''} ${n === 1 && !more ? words.lowerOne : words.lowerMany}`,
    },
  ];
  let soon = 0;
  for (const item of items) if (daysLeft(item.trashedAt ?? now, now) <= SOON_DAYS) soon += 1;
  if (soon > 0) stats.push({ label: `${soon.toLocaleString()} leaving this week`, tone: 'soon' });
  return stats;
}
