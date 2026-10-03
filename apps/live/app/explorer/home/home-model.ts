// Home's pure view model (docs/specs/013-workspace/explorer-home.md; blueprint
// docs/specs/013-workspace/blueprints/explorer-home-view.md): Jump back in's Within reach set and
// its phone order, which day heads which What happened entries, and when the strip fades.

import {
  HOME_WITHIN_REACH_PER_ROW,
  useWindowStart,
  utcDay,
  withinReach,
  type HomeDocument,
  type HomeGroup,
  type HomeJumpBackInItem,
  type WithinReach,
} from '@livediagram/api-schema';
import { dateKey, formatDay } from '@livediagram/ui';
import type { LocalOpenDocument } from '@/lib/offline/offline-opens';

/** One document of Jump back in: a server document or one stored only in this browser. */
export type JumpBackInItem = {
  documentId: string;
  name: string;
  href: string;
  savedAt: number;
  empty: boolean;
  /** Authorises a shared document's thumbnail. */
  shareCode: string | null;
  /** Use days in the window: the most-used measure. */
  useDays: number;
  /** The later of the last open and the last edit: the recent measure. */
  lastUsedAt: number;
  /** Stored only in this browser: carries the Local only pill. */
  localOnly: boolean;
};

/** Which half of the set an item came from; never shown, only tracked. */
export type JumpBackInGroup = 'mostUsed' | 'recent';

export type JumpBackInSet = WithinReach<JumpBackInItem>;

/** Where activating a document goes: a shared one through its link, the rest on their path. */
export function homeDocumentHref(doc: Pick<HomeDocument, 'documentId' | 'via' | 'shareCode'>) {
  const path = `/document/${encodeURIComponent(doc.documentId)}`;
  return doc.via === 'shared' && doc.shareCode
    ? `${path}?s=${encodeURIComponent(doc.shareCode)}`
    : path;
}

/** Jump back in: the server's set and this browser's opened local documents, allocated as one
 *  Within reach set. Sorted by id first: the stable order the merge property needs. */
export function jumpBackInSet(
  server: readonly HomeJumpBackInItem[],
  local: readonly LocalOpenDocument[],
  now: number,
  n = HOME_WITHIN_REACH_PER_ROW,
): JumpBackInSet {
  const from = utcDay(useWindowStart(now));
  const items: JumpBackInItem[] = [
    ...server.map((d) => ({
      documentId: d.documentId,
      name: d.name,
      href: homeDocumentHref(d),
      savedAt: d.savedAt,
      empty: d.empty,
      shareCode: d.via === 'shared' ? d.shareCode : null,
      useDays: d.useDays,
      lastUsedAt: d.lastUsedAt,
      localOnly: false,
    })),
    ...local.map(({ document, opens }) => ({
      documentId: document.id,
      name: document.name,
      href: `/document/${encodeURIComponent(document.id)}`,
      savedAt: document.savedAt,
      empty: document.empty,
      shareCode: null,
      useDays: opens.days.filter((d) => d >= from).length,
      // Only the person edits a document stored here, so its save is their last edit.
      lastUsedAt: Math.max(opens.lastOpenedAt, document.savedAt),
      localOnly: true,
    })),
  ];
  items.sort((a, b) => (a.documentId < b.documentId ? -1 : a.documentId > b.documentId ? 1 : 0));
  return withinReach(items, n, (d) => ({ uses: d.useDays, lastUsedAt: d.lastUsedAt }));
}

/** The phone's strip: most used, recent, alternating; the rest of the longer group after. */
export function phoneOrder(
  set: JumpBackInSet,
): { item: JumpBackInItem; group: JumpBackInGroup }[] {
  const out: { item: JumpBackInItem; group: JumpBackInGroup }[] = [];
  const length = Math.max(set.mostUsed.length, set.recent.length);
  for (let i = 0; i < length; i += 1) {
    const used = set.mostUsed[i];
    const recent = set.recent[i];
    if (used) out.push({ item: used, group: 'mostUsed' });
    if (recent) out.push({ item: recent, group: 'recent' });
  }
  return out;
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
