// Home's pure view model (docs/specs/013-workspace/explorer-home.md; blueprint
// docs/specs/013-workspace/blueprints/explorer-home-view.md): what the strip lists, how the
// Timeline folds and alternates, which day heads which entries, and when the strip fades.

import {
  HOME_JUMP_BACK_IN_MAX,
  type HomeDocument,
  type HomeGroup,
  type HomeJumpBackInItem,
  type HomeTimelineEntry,
  type HomeTimelineKind,
} from '@livediagram/api-schema';
import { dateKey, formatDay } from '@livediagram/ui';
import type { LocalOpenDocument } from '@/lib/offline/offline-opens';

/** One thumbnail of Jump back in: a server document or one stored only in this browser. */
export type JumpBackInItem = {
  documentId: string;
  name: string;
  href: string;
  savedAt: number;
  empty: boolean;
  /** Authorises a shared document's thumbnail. */
  shareCode: string | null;
  frecencyKey: number;
  /** Stored only in this browser: carries the Local only pill. */
  localOnly: boolean;
};

export type TimelineSide = 'start' | 'end';

export type TimelineRow =
  | { type: 'day'; key: string; label: string }
  | { type: 'entry'; entry: HomeTimelineEntry; side: TimelineSide };

/** Where activating a document goes: a shared one through its link, the rest on their path. */
export function homeDocumentHref(doc: Pick<HomeDocument, 'documentId' | 'via' | 'shareCode'>) {
  const path = `/document/${encodeURIComponent(doc.documentId)}`;
  return doc.via === 'shared' && doc.shareCode
    ? `${path}?s=${encodeURIComponent(doc.shareCode)}`
    : path;
}

/** The strip: the server's ranked documents and this browser's opened local ones, as one list
 *  by frecency key (ties by id), the strongest `max`. */
export function mergeJumpBackIn(
  server: readonly HomeJumpBackInItem[],
  local: readonly LocalOpenDocument[],
  max = HOME_JUMP_BACK_IN_MAX,
): JumpBackInItem[] {
  const items: JumpBackInItem[] = [
    ...server.map((d) => ({
      documentId: d.documentId,
      name: d.name,
      href: homeDocumentHref(d),
      savedAt: d.savedAt,
      empty: d.empty,
      shareCode: d.via === 'shared' ? d.shareCode : null,
      frecencyKey: d.frecencyKey,
      localOnly: false,
    })),
    ...local.map(({ document, opens }) => ({
      documentId: document.id,
      name: document.name,
      href: `/document/${encodeURIComponent(document.id)}`,
      savedAt: document.savedAt,
      empty: document.empty,
      shareCode: null,
      frecencyKey: opens.frecencyKey,
      localOnly: true,
    })),
  ];
  return items
    .sort(
      (a, b) =>
        b.frecencyKey - a.frecencyKey ||
        (a.documentId < b.documentId ? -1 : a.documentId > b.documentId ? 1 : 0),
    )
    .slice(0, max);
}

const STRENGTH: Record<HomeTimelineKind, number> = { created: 3, updated: 2, opened: 1 };

function newestFirst(a: HomeTimelineEntry, b: HomeTimelineEntry): number {
  return b.occurredAt - a.occurredAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
}

/** One entry per document per day (`dayOf`): the strongest kind, at that event's time; of equal
 *  strength, the newest. Newest first. */
export function foldTimeline(
  items: readonly HomeTimelineEntry[],
  dayOf: (at: number) => string,
): HomeTimelineEntry[] {
  const kept = new Map<string, HomeTimelineEntry>();
  for (const item of items) {
    const key = `${item.documentId}:${dayOf(item.occurredAt)}`;
    const held = kept.get(key);
    const stronger =
      !held ||
      STRENGTH[item.kind] > STRENGTH[held.kind] ||
      (STRENGTH[item.kind] === STRENGTH[held.kind] && newestFirst(item, held) < 0);
    if (stronger) kept.set(key, item);
  }
  return [...kept.values()].sort(newestFirst);
}

function previousDay(now: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return dateKey(d.getTime());
}

/** A local day's heading: Today, Yesterday, then the date, with its year when not this one. */
export function dayHeading(day: string, now: number): string {
  if (day === dateKey(now)) return 'Today';
  if (day === previousDay(now)) return 'Yesterday';
  const { label, year } = formatDay(day);
  return year && year !== String(new Date(now).getFullYear()) ? `${label} ${year}` : label;
}

/** The Timeline column: a day row before each local day, entries alternating sides throughout. */
export function timelineRows(entries: readonly HomeTimelineEntry[], now: number): TimelineRow[] {
  const rows: TimelineRow[] = [];
  let lastDay: string | null = null;
  entries.forEach((entry, index) => {
    const day = dateKey(entry.occurredAt);
    if (day !== lastDay) {
      rows.push({ type: 'day', key: day, label: dayHeading(day, now) });
      lastDay = day;
    }
    rows.push({ type: 'entry', entry, side: index % 2 === 0 ? 'start' : 'end' });
  });
  return rows;
}

/** What happened under its day headings, in the order the api sent the groups. */
export function groupsByDay(
  groups: readonly HomeGroup[],
  now: number,
): { day: string; label: string; groups: HomeGroup[] }[] {
  const days: { day: string; label: string; groups: HomeGroup[] }[] = [];
  for (const group of groups) {
    let day = days.find((d) => d.day === group.day);
    if (!day) {
      day = { day: group.day, label: dayHeading(group.day, now), groups: [] };
      days.push(day);
    }
    day.groups.push(group);
  }
  return days;
}

/** Sub-pixel scroll widths leave the end a fraction short. */
const STRIP_FADE_EPSILON_PX = 1;

/** The strip's trailing fade shows while more lies to the right. */
export function stripFade(box: { scrollLeft: number; clientWidth: number; scrollWidth: number }) {
  return box.scrollLeft + box.clientWidth < box.scrollWidth - STRIP_FADE_EPSILON_PX;
}
