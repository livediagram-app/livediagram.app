// The Timeline's pure rules (livediagram's @livediagram/ui timeline, brought over for the index's events): what a
// card is made of, the day an event falls on, which events fold into one card, what colour and filter chip each
// kind of event gets, and whether it is new. No React here beyond the types, so each rule is tested on its own.

import { APP_KINDS, type TimelineEvent, type TimelineEventType } from '@liveworkspace/index-client';
import type { MouseEvent, ReactNode } from 'react';
import { kindWords } from '../words';

export type { TimelineEvent };

// ---------- Cards ----------------------------------------------------------------------------------------------

export type TimelineCardRender = {
  // The event's glyph: small in the reason line, large in the preview box when there is no picture.
  icon: ReactNode;
  // The card's title: the item as it is called now.
  subject?: ReactNode;
  // Why the card is here, Title Case ("Plan Renamed").
  label?: ReactNode;
  // Free text under the reason line; null shows nothing.
  description?: ReactNode | null;
  // Quiet detail after the time: "by you", "Was Roadmap".
  meta?: ReactNode;
  // Fills the preview box (the item's thumbnail).
  preview?: ReactNode;
  // A mark at the preview's top right: the item's app, while every app's events show.
  badge?: ReactNode;
  // Makes the whole card open what it is about.
  onClick?: () => void;
};

export type TimelineCardSlots = {
  subject?: ReactNode;
  title?: ReactNode;
  menu?: ReactNode;
  onContextMenu?: (e: MouseEvent) => void;
};

export type TimelineRenderer = (event: TimelineEvent) => TimelineCardRender;

/** List or month grid. */
export type TimelineMode = 'list' | 'calendar';

// ---------- Days -----------------------------------------------------------------------------------------------

export type TimelineDayGroup = {
  // YYYY-MM-DD in the reader's own time zone: the key, and the scroll target.
  key: string;
  // "Tue, 5 Aug"
  label: string;
  year: string;
  isToday: boolean;
  // After today: a scheduled event, drawn in the Upcoming band above Today.
  isFuture: boolean;
  events: TimelineEvent[];
};

/** The reader's local day. The index keys an edit by UTC day (one row serves everyone); display is local. */
export function dateKey(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Time of day in the reader's locale. */
export function timeLabel(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** "Tue, 5 Aug" and its year, assembled from parts so it reads the same on every ICU. */
export function formatDay(key: string): { label: string; year: string } {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y!, m! - 1, d);
  if (Number.isNaN(date.getTime())) return { label: key, year: '' };
  const parts = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { label: `${part('weekday')}, ${part('day')} ${part('month')}`, year: String(y) };
}

/** Newest-first events, one group per local day, by key rather than adjacency. */
export function groupByDay(events: readonly TimelineEvent[], now = Date.now()): TimelineDayGroup[] {
  const today = dateKey(now);
  const byKey = new Map<string, TimelineDayGroup>();
  for (const event of events) {
    const key = dateKey(event.occurredAt);
    let group = byKey.get(key);
    if (!group) {
      // YYYY-MM-DD compares as text in date order.
      group = { key, ...formatDay(key), isToday: key === today, isFuture: key > today, events: [] };
      byKey.set(key, group);
    }
    group.events.push(event);
  }
  return [...byKey.values()];
}

// ---------- Months (the calendar and the filter's mini calendar) ------------------------------------------------

export type MonthCell = { key: string | null; day: number | null };

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** "2026-08" → whole weeks of cells, Monday first, pads keyless. */
export function buildMonthCells(monthKey: string): MonthCell[] {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return [];
  const pad = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const days = new Date(year, month, 0).getDate();
  const cells: MonthCell[] = Array.from({ length: pad }, () => ({ key: null, day: null }));
  for (let day = 1; day <= days; day += 1) {
    cells.push({ key: `${monthKey}-${String(day).padStart(2, '0')}`, day });
  }
  while (cells.length % 7 !== 0) cells.push({ key: null, day: null });
  return cells;
}

export function monthKeyOf(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const d = new Date(year!, month! - 1 + delta, 1);
  return monthKeyOf(d.getTime());
}

export function formatMonth(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year!, month! - 1, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
}

// ---------- What an event says ---------------------------------------------------------------------------------

const VERBS: Record<TimelineEventType, string> = {
  created: 'Created',
  edited: 'Updated',
  renamed: 'Renamed',
  moved: 'Moved',
  trashed: 'Moved to Trash',
  restored: 'Restored',
  shared: 'Shared',
  unshared: 'Sharing Stopped',
  favourited: 'Added to Favourites',
};

const isTimelineType = (type: string): type is TimelineEventType => type in VERBS;

/** The reason line, Title Case: the item's kind and what happened ("Plan Renamed", "Canvas Made by AI"). */
export function eventLabel(event: TimelineEvent): string {
  const kind = kindWords(event.app).one;
  if (event.type === 'created' && event.detail?.source === 'ai') return `${kind} Made by AI`;
  if (event.type === 'created' && event.detail?.source === 'import') return `${kind} Imported`;
  if (event.type === 'created' && event.detail?.copiedFrom) return `${kind} Copied`;
  return `${kind} ${isTimelineType(event.type) ? VERBS[event.type] : 'Changed'}`;
}

// ---------- Tone: what an event's colour means ------------------------------------------------------------------

// Three meanings: something went (danger), the shape of things changed (structural), something was made or
// worked on (create). Anything else is neutral rather than a guess.
export type TimelineTone = 'danger' | 'structural' | 'create' | 'neutral';

const TONE_BY_TYPE: Record<TimelineEventType, TimelineTone> = {
  trashed: 'danger',
  renamed: 'structural',
  moved: 'structural',
  shared: 'structural',
  unshared: 'structural',
  created: 'create',
  edited: 'create',
  restored: 'create',
  favourited: 'create',
};

export function eventTone(type: string): TimelineTone {
  return isTimelineType(type) ? TONE_BY_TYPE[type] : 'neutral';
}

export const TONE_LABELS: Record<TimelineTone, string> = {
  danger: 'Removed',
  structural: 'Changed',
  create: 'Created',
  neutral: 'Other',
};

const TONE_FALLBACK: Record<TimelineTone, { bold: string; soft: string }> = {
  danger: { bold: '#dc2626', soft: 'rgba(220, 38, 38, 0.10)' },
  structural: { bold: '#b45309', soft: 'rgba(217, 119, 6, 0.10)' },
  create: { bold: '#047857', soft: 'rgba(5, 150, 105, 0.10)' },
  neutral: { bold: '#64748b', soft: 'rgba(100, 116, 139, 0.10)' },
};

// The host may set --lw-timeline-<tone>(-soft); these are the fallbacks.
export const toneColor = (tone: TimelineTone) =>
  `var(--lw-timeline-${tone}, ${TONE_FALLBACK[tone].bold})`;
export const toneSoftColor = (tone: TimelineTone) =>
  `var(--lw-timeline-${tone}-soft, ${TONE_FALLBACK[tone].soft})`;

// ---------- Categories: the filter's chips ----------------------------------------------------------------------

export type TimelineCategory =
  'new' | 'edits' | 'renames' | 'deletions' | 'sharing' | 'filing' | 'favourites' | 'other';

const CATEGORY_BY_TYPE: Record<TimelineEventType, TimelineCategory> = {
  created: 'new',
  edited: 'edits',
  renamed: 'renames',
  trashed: 'deletions',
  restored: 'deletions',
  shared: 'sharing',
  unshared: 'sharing',
  moved: 'filing',
  favourited: 'favourites',
};

export function eventCategory(type: string): TimelineCategory {
  return isTimelineType(type) ? CATEGORY_BY_TYPE[type] : 'other';
}

export const CATEGORY_LABELS: Record<TimelineCategory, string> = {
  new: 'Created',
  edits: 'Edits',
  renames: 'Renames',
  deletions: 'Trash',
  sharing: 'Sharing',
  filing: 'Organisation',
  favourites: 'Favourites',
  other: 'Other',
};

// A fixed order, so the chips never rearrange as the feed changes under them.
const CATEGORY_ORDER: TimelineCategory[] = [
  'new',
  'edits',
  'renames',
  'deletions',
  'sharing',
  'filing',
  'favourites',
  'other',
];

export function sortCategories(categories: Iterable<TimelineCategory>): TimelineCategory[] {
  return [...categories].sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b));
}

// ---------- Stacking: a day's runs of the same kind fold into one card ------------------------------------------

export type TimelineStack = { key: string; bucket: string; events: TimelineEvent[] };

// Two halves of one moment share a bucket.
const BUCKET_ALIASES: Partial<Record<TimelineEventType, string>> = {
  shared: 'sharing',
  unshared: 'sharing',
  trashed: 'trash',
  restored: 'trash',
};

export function bucketFor(event: TimelineEvent): string {
  return (isTimelineType(event.type) && BUCKET_ALIASES[event.type]) || event.type;
}

/** One day's events (newest first) into stacks by kind, each where its newest member falls. */
export function buildStacks(events: readonly TimelineEvent[]): TimelineStack[] {
  const stacks: TimelineStack[] = [];
  const byBucket = new Map<string, TimelineStack>();
  for (const event of events) {
    const bucket = bucketFor(event);
    const existing = byBucket.get(bucket);
    if (existing) existing.events.push(event);
    else {
      const created: TimelineStack = { key: event.id, bucket, events: [event] };
      stacks.push(created);
      byBucket.set(bucket, created);
    }
  }
  return stacks;
}

const STACK_VERBS: Record<string, string> = {
  created: 'Created',
  edited: 'Updated',
  renamed: 'Renamed',
  moved: 'Filed',
  trash: 'Trashed or Restored',
  sharing: 'Sharing Changed',
  favourited: 'Added to Favourites',
};

/** A stack's headline, true of every member: "Plans Updated", or "Items Updated" across apps. */
export function stackLabel(stack: TimelineStack): string {
  const apps = new Set(stack.events.map((e) => e.app));
  const first = stack.events[0]!;
  const many = apps.size === 1 ? kindWords(first.app).many : 'Items';
  return `${many} ${STACK_VERBS[stack.bucket] ?? 'Changed'}`;
}

/** An item made and worked on the same local day is one card: its edit that day says nothing more. */
export function collapseSameDayCreate(events: readonly TimelineEvent[]): TimelineEvent[] {
  const created = new Set<string>();
  for (const e of events) {
    if (e.type === 'created') created.add(`${e.itemId}|${dateKey(e.occurredAt)}`);
  }
  if (created.size === 0) return [...events];
  return events.filter(
    (e) => e.type !== 'edited' || !created.has(`${e.itemId}|${dateKey(e.occurredAt)}`),
  );
}

// ---------- New since last look ---------------------------------------------------------------------------------

/** New to this reader: after the last look, and not someone's own doing. Never-looked marks nothing new. */
export function isNewEvent(
  event: Pick<TimelineEvent, 'occurredAt' | 'actorId'>,
  lastSeenAt: number | null,
  viewerId: string | null,
  now = Date.now(),
): boolean {
  if (lastSeenAt === null) return false;
  if (viewerId && event.actorId === viewerId) return false;
  return event.occurredAt > lastSeenAt && event.occurredAt <= now;
}

/** The kind an app's events are, for its words. */
export const kindOfApp = (app: TimelineEvent['app']) => APP_KINDS[app];

// ---------- Motion ---------------------------------------------------------------------------------------------

/** The entry delay of the card at `index` in the feed's cascade: 10 ms a step, capped so the last lands by 250 ms. */
export function cascadeDelayMs(index: number): number {
  const i = Number.isNaN(index) ? 0 : Math.max(0, Math.floor(index));
  return Math.min(i * 10, 100);
}
