// Home's What Happened (livediagram's home-model and what-happened, brought over for the index's Timeline): what
// other people did to the items the reader can open, one group per item per local day, under day headings. A group
// with one person lists that person's doings; a group with several folds into one sentence that names them all.
// Pure, so each rule is tested without the view.

import type { TimelineEvent, TimelineEventType } from '@liveworkspace/index-client';
import { dateKey, formatDay } from './model';

// One read of the index's Timeline: at most this many events, of which Home keeps others' doings.
export const WHAT_HAPPENED_PAGE = 30;
// A summary names this many people, then "and N others".
export const SUMMARY_NAMES_MAX = 3;

/** The verbs What Happened says, in the order a summary lists them. A favourite is only its person's. */
export const WHAT_HAPPENED_VERBS = [
  'created',
  'edited',
  'renamed',
  'moved',
  'shared',
  'unshared',
  'trashed',
  'restored',
  'synced',
  'commented',
  'comment_resolved',
  'action_assigned',
  'action_done',
] as const satisfies readonly TimelineEventType[];
export type WhatHappenedVerb = (typeof WHAT_HAPPENED_VERBS)[number];

const VERB_ORDER = new Map<string, number>(WHAT_HAPPENED_VERBS.map((verb, i) => [verb, i]));

/** One person's doing, before and after the item's name: "renamed ‹Budget›", "moved ‹Budget› to the Trash". */
export const ACTION_PHRASES: Readonly<Record<WhatHappenedVerb, [string, string | null]>> = {
  created: ['made', null],
  edited: ['edited', null],
  renamed: ['renamed', null],
  moved: ['moved', null],
  shared: ['shared', 'by link'],
  unshared: ['stopped sharing', null],
  trashed: ['moved', 'to the Trash'],
  restored: ['restored', 'from the Trash'],
  synced: ['synced', 'back to the cloud'],
  commented: ['commented on', null],
  comment_resolved: ['resolved a comment on', null],
  action_assigned: ['assigned an action on', null],
  action_done: ['finished an action on', null],
};

/** Each verb as a summary lists it: "Sam and Ana edited and renamed ‹Budget›". */
export const VERB_PHRASES: Readonly<Record<WhatHappenedVerb, string>> = {
  created: 'made',
  edited: 'edited',
  renamed: 'renamed',
  moved: 'moved',
  shared: 'shared',
  unshared: 'stopped sharing',
  trashed: 'trashed',
  restored: 'restored',
  synced: 'synced',
  commented: 'commented on',
  comment_resolved: 'resolved comments on',
  action_assigned: 'assigned actions on',
  action_done: 'finished actions on',
};

export type WhatHappenedPerson = { id: string; name: string };

export type WhatHappenedGroup = {
  // `<itemId>:<day>`
  id: string;
  day: string;
  item: NonNullable<TimelineEvent['item']>;
  app: TimelineEvent['app'];
  // Newest first.
  actions: TimelineEvent[];
  people: WhatHappenedPerson[];
  verbs: WhatHappenedVerb[];
  // More than one person: one entry with a sentence that opens to every doing.
  summary: boolean;
  latestAt: number;
};

export type WhatHappenedDay = { day: string; label: string; groups: WhatHappenedGroup[] };

const isVerb = (type: string): type is WhatHappenedVerb => VERB_ORDER.has(type);

/** Who did it, as Home names them. The index keeps no names: an app's report may carry one. */
export function personName(event: Pick<TimelineEvent, 'actorId' | 'actorName'>): string {
  const name = event.actorName?.trim();
  if (name) return name;
  if (event.actorId === 'deleted') return 'A closed account';
  return 'A teammate';
}

/** Others' doings to an item only: the reader's own, events nobody did, and those about no item (a team, a
 *  token) are not Home's news. */
export function isOthers(event: TimelineEvent, viewerId: string | null): boolean {
  if (!event.actorId || !event.item) return false;
  if (viewerId && event.actorId === viewerId) return false;
  return isVerb(event.type);
}

/** Newest-first events → one group per item per local day, groups newest first. */
export function groupWhatHappened(
  events: readonly TimelineEvent[],
  viewerId: string | null,
): WhatHappenedGroup[] {
  const groups = new Map<string, WhatHappenedGroup & { seen: Set<string>; verbSet: Set<string> }>();
  for (const event of events) {
    if (!isOthers(event, viewerId)) continue;
    const day = dateKey(event.occurredAt);
    const id = `${event.itemId}:${day}`;
    let group = groups.get(id);
    if (!group) {
      group = {
        id,
        day,
        item: event.item!,
        app: event.app,
        actions: [],
        people: [],
        verbs: [],
        summary: false,
        latestAt: event.occurredAt,
        seen: new Set(),
        verbSet: new Set(),
      };
      groups.set(id, group);
    }
    group.actions.push(event);
    group.latestAt = Math.max(group.latestAt, event.occurredAt);
    const who = event.actorId!;
    if (!group.seen.has(who)) {
      group.seen.add(who);
      group.people.push({ id: who, name: personName(event) });
    }
    group.verbSet.add(event.type);
  }
  return [...groups.values()]
    .map(({ seen: _seen, verbSet, ...group }) => ({
      ...group,
      summary: group.people.length > 1,
      verbs: [...verbSet].filter(isVerb).sort((a, b) => VERB_ORDER.get(a)! - VERB_ORDER.get(b)!),
    }))
    .sort((a, b) => b.latestAt - a.latestAt);
}

/** "Today", "Yesterday", or "Tue, 5 Aug" (with its year when not this year's). */
export function dayHeading(day: string, now: number): string {
  if (day === dateKey(now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === dateKey(yesterday.getTime())) return 'Yesterday';
  const { label, year, withYear } = formatDay(day);
  return year && year !== String(new Date(now).getFullYear()) ? withYear : label;
}

/** Groups under their day headings, in the groups' order. */
export function groupsByDay(groups: readonly WhatHappenedGroup[], now: number): WhatHappenedDay[] {
  const days: WhatHappenedDay[] = [];
  const byDay = new Map<string, WhatHappenedDay>();
  for (const group of groups) {
    let day = byDay.get(group.day);
    if (!day) {
      day = { day: group.day, label: dayHeading(group.day, now), groups: [] };
      byDay.set(group.day, day);
      days.push(day);
    }
    day.groups.push(group);
  }
  return days;
}

function joinAnd(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** "Priya", "Priya and Sam", "Priya, Sam and Lee", "Priya, Sam, Lee and 2 others". */
export function peopleList(people: readonly WhatHappenedPerson[]): string {
  const names = people.map((p) => p.name);
  if (names.length <= SUMMARY_NAMES_MAX) return joinAnd(names);
  const rest = names.length - SUMMARY_NAMES_MAX;
  return `${names.slice(0, SUMMARY_NAMES_MAX).join(', ')} and ${rest} ${rest === 1 ? 'other' : 'others'}`;
}

/** "edited, renamed and moved". */
export function verbList(verbs: readonly WhatHappenedVerb[]): string {
  return joinAnd(verbs.map((verb) => VERB_PHRASES[verb]));
}

export function updatesLabel(total: number): string {
  return `${total} ${total === 1 ? 'update' : 'updates'}`;
}

/** A person's initials for their avatar: "Sam Lee" → "SL"; "A teammate" has none. */
export function initials(name: string): string | null {
  if (name === 'A teammate' || name === 'A closed account') return null;
  const words = name.split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0]!, words[words.length - 1]!] : words.slice(0, 1);
  const out = letters.map((w) => [...w][0]!.toUpperCase()).join('');
  return out || null;
}
