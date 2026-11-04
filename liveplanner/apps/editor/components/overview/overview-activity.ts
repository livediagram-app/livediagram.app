// The Overview's Recent Activity (docs/specs/026-plan/plan-overview.md "Recent Activity"): what the plan records of
// who did what to its cards, newest first, never more than ACTIVITY_MAX. Pure. Card types, tabs, forms and sharing
// keep no record of who changed them or when, so they are never listed; the plan's own making is.
import {
  STATUS_SINCE_FIELD,
  isTrashed,
  itemStatus,
  statusLabel,
  type Item,
  type ItemPerson,
  type ItemTypeDef,
} from '@liveplanner/items';
import { boardShows, boardStatuses, type OverviewBoard } from './overview-boards';
import { shortDate } from './overview-dates';

// Shown before See All (blueprint DEFAULTS D80), and the most ever listed.
export const ACTIVITY_SHOWN = 8;
export const ACTIVITY_MAX = 30;

export type ActivityKind = 'added' | 'moved' | 'changed' | 'deleted' | 'created-plan';

export type ActivityEntry = {
  // Unique within the list.
  key: string;
  kind: ActivityKind;
  at: number;
  // Who did it. `id` tells runs of one person apart (samePerson); '' when unknown.
  by: ActivityPerson;
  // What was done, after the person's name ("moved Fix login to Done").
  text: string;
  // The same in parts, for drawing the title in bold: the verb ("moved"), the card's title (null for the plan's own
  // entries), and for a move the column's name it went to (null otherwise).
  verb: string;
  title: string | null;
  to: string | null;
  // The card's type id, for its chip (null for the plan's own entries).
  typeId: string | null;
  // Where it happened: a Board tab's name, "Cards", "Trash" or "Plan".
  where: string;
  // The card it is about, opened when the entry is pressed; null for the plan's own entries.
  itemId: string | null;
  // A change to the plan's setup rather than to a card: drawn with the brand dot.
  setup: boolean;
};

const titleOf = (it: Item): string => {
  const t = it.fields['title'];
  return typeof t === 'string' && t.trim() ? t.trim() : 'Untitled';
};

// Newest first; at the same moment, the later card key first, so the order never depends on the store's.
const newer = (a: ActivityEntry, b: ActivityEntry) =>
  b.at - a.at || (a.key < b.key ? 1 : a.key > b.key ? -1 : 0);

// Keeps `list` the `max` newest entries, in order, without sorting everything ever offered.
function keep(list: ActivityEntry[], entry: ActivityEntry, max: number): void {
  if (list.length >= max && newer(entry, list[list.length - 1]!) >= 0) return;
  let i = list.length;
  while (i > 0 && newer(entry, list[i - 1]!) < 0) i -= 1;
  list.splice(i, 0, entry);
  if (list.length > max) list.pop();
}

export type ActivityPerson = { id: string; name: string; color: string };

export type ActivityInput = {
  items: ReadonlyMap<string, Item>;
  types: readonly ItemTypeDef[];
  boards: readonly OverviewBoard[];
  statusNames?: ReadonlyMap<string, string>;
  // The plan's own making: its owner and creation time, when known.
  plan?: { createdAt: number; by: { id?: string; name: string; color: string } | null };
  max?: number;
};

const person = (p: ItemPerson): ActivityPerson => ({
  id: p.id ?? '',
  name: p.name || 'Someone',
  color: p.color,
});

export function recentActivityOf(input: ActivityInput): ActivityEntry[] {
  const max = input.max ?? ACTIVITY_MAX;
  const out: ActivityEntry[] = [];
  const boards = input.boards.map((b) => ({ b, statuses: boardStatuses(b.setup) }));
  // Where a card is: the first Board tab whose board shows it.
  const whereOf = (it: Item): string => {
    if (isTrashed(it)) return 'Trash';
    for (const { b, statuses } of boards)
      if (boardShows(b.setup, it, input.types, statuses)) return b.tabName;
    return 'Cards';
  };
  for (const it of input.items.values()) {
    const title = titleOf(it);
    keep(
      out,
      {
        key: `${it.id}:made`,
        kind: 'added',
        at: it.createdAt,
        by: person(it.createdBy),
        text: `added ${title}`,
        verb: 'added',
        title,
        to: null,
        typeId: it.type,
        where: '',
        itemId: it.id,
        setup: false,
      },
      max,
    );
    if (it.updatedAt <= it.createdAt) continue;
    let kind: ActivityKind = 'changed';
    let to: string | null = null;
    if (isTrashed(it)) kind = 'deleted';
    else if (it.fields[STATUS_SINCE_FIELD] === it.updatedAt) {
      const status = itemStatus(it);
      if (status) {
        kind = 'moved';
        to = statusLabel(status, input.statusNames);
      }
    }
    const verb = kind === 'deleted' ? 'deleted' : kind === 'moved' ? 'moved' : 'changed';
    keep(
      out,
      {
        key: `${it.id}:last`,
        kind,
        at: it.updatedAt,
        by: person(it.updatedBy),
        text: to ? `${verb} ${title} to ${to}` : `${verb} ${title}`,
        verb,
        title,
        to,
        typeId: it.type,
        where: '',
        itemId: it.id,
        setup: false,
      },
      max,
    );
  }
  const plan = input.plan;
  if (plan && plan.createdAt > 0)
    keep(
      out,
      {
        key: 'plan:made',
        kind: 'created-plan',
        at: plan.createdAt,
        by: plan.by
          ? { id: plan.by.id ?? '', name: plan.by.name || 'Someone', color: plan.by.color }
          : { id: '', name: 'Someone', color: '#64748b' },
        text: 'created the plan',
        verb: 'created the plan',
        title: null,
        to: null,
        typeId: null,
        where: 'Plan',
        itemId: null,
        setup: true,
      },
      max,
    );
  // Where each kept entry happened, worked out for the kept ones alone.
  return out.map((e) => {
    if (!e.itemId) return e;
    const it = input.items.get(e.itemId);
    return { ...e, where: it ? whereOf(it) : 'Cards' };
  });
}

// One person in two entries: the same id, or (ids differ between an owner's account and a card's person) the same
// name and colour.
export const samePerson = (a: ActivityPerson, b: ActivityPerson): boolean =>
  (a.id !== '' && a.id === b.id) || (a.name === b.name && a.color === b.color);

// A local calendar day, "2026-11-04", for grouping entries by the day they happened.
export function dayKeyOf(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// A day's heading: Today, Yesterday, else its date ("14 Oct", with the year when not this one).
export function dayLabelOf(at: number, now: number, locale?: string): string {
  const day = dayKeyOf(at);
  if (day === dayKeyOf(now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === dayKeyOf(yesterday.getTime())) return 'Yesterday';
  return shortDate(at, now, locale);
}

export type ActivityRow = {
  entry: ActivityEntry;
  // Its place in the list as shown (0 is the newest), which paces its entrance.
  index: number;
  // The first of a run of entries by one person within a day: it draws their disc; the rest sit under it.
  leads: boolean;
};

export type ActivityDay = { key: string; label: string; rows: ActivityRow[] };

// Entries (newest first) grouped under their day, each marked whether it leads a run by one person. Linear.
export function activityDaysOf(
  entries: readonly ActivityEntry[],
  now: number,
  locale?: string,
): ActivityDay[] {
  const days: ActivityDay[] = [];
  let day: ActivityDay | null = null;
  entries.forEach((entry, index) => {
    const key = dayKeyOf(entry.at);
    if (!day || day.key !== key) {
      day = { key, label: dayLabelOf(entry.at, now, locale), rows: [] };
      days.push(day);
    }
    const prev = day.rows[day.rows.length - 1];
    day.rows.push({ entry, index, leads: !prev || !samePerson(prev.entry.by, entry.by) });
  });
  return days;
}
