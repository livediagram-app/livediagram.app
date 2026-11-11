// What one tab save changed, by id (docs/specs/012-collaboration/collab-race-hardening.md "A save is merged with the
// stored tab"): its page steps, and the photo pages whose picture it changed. The editor sends them beside the whole
// tab (`X-Save-Changes`, @liveworkspace/api-schema/tab-save-changes), and the api applies them over the tab it has
// stored, so two Editors adding a page at the same moment both keep it, and its picture, after a reload (Work
// Tracker #669, #717). Elements are not here: they have the changeset merge and the room's ledger.
import type { IdListStep } from '@liveworkspace/model-core/id-list-steps';
import { sameJsonValue } from '@liveworkspace/model-core/same-json-value';
import {
  MAX_PAGE_STEPS,
  pagesWithSteps,
  parsePageSteps,
  savedPagesOver,
  tabPageSteps,
  type PageCap,
} from '@liveworkspace/model-core/tab-page-steps';
import { PHOTO_MAX_PAGES } from '@livedesign/photo-engine';
import { pagesOf, type Page } from './page';
import { MAX_PAGES } from './page-sizes';
import type { Tab } from './index';

/** `photos`: the pages whose picture the save changed, set or removed (each picture from the saved tab). */
export type TabSaveChanges = { pages?: IdListStep[]; photos?: string[] };

const readPages = (tab: { pages?: unknown } | undefined) => pagesOf(tab);

/** A tab's page caps, held when pages from two Editors merge (collab-race-hardening.md "At the page cap"). */
const PAGE_CAPS: readonly PageCap<Page>[] = [
  { max: MAX_PAGES },
  { max: PHOTO_MAX_PAGES, counts: (p) => p.kind === 'photo' },
];

const MAX_PAGE_ID = 200;

/** The steps a change from `before` to `after` makes to the tab's pages, by id (collab-race-hardening.md "Pages"):
 *  sent with every op that carries the pages, and with every save. */
export function pageStepsOf(before: Tab, after: Tab, previous?: Tab): IdListStep[] {
  return tabPageSteps(before, after, readPages, previous);
}

/** A peer's page change applied over `local`'s pages: its `steps`, each page from `sent` (the peer's whole list),
 *  both read defensively, so a page added here meanwhile stays. Null when the peer sent no readable steps (an older
 *  sender): its whole list then stands. */
export function withPeerPageSteps(local: Tab, steps: unknown, sent: unknown): Page[] | null {
  const read = parsePageSteps(steps);
  if (!read || !Array.isArray(sent)) return null;
  return pagesWithSteps(local, read, readPages({ pages: sent }), readPages, PAGE_CAPS);
}

/** The changes from `before` (the save baseline) to `after` (the tab saved). `previous` is this editor's last save
 *  of the tab while it may still be in flight: a page or picture it held that `after` lacks is removed too. */
export function tabSaveChanges(before: Tab, after: Tab, previous?: Tab): TabSaveChanges {
  return {
    pages: pageStepsOf(before, after, previous),
    photos: photoChanges(before, after, previous),
  };
}

function rawPhotos(tab: Tab): Record<string, unknown> {
  const a = (tab as { photos?: unknown }).photos;
  return a && typeof a === 'object' && !Array.isArray(a) ? (a as Record<string, unknown>) : {};
}

// The pages whose picture differs from the baseline's, or that a save in flight held and this one lacks.
function photoChanges(before: Tab, after: Tab, previous: Tab | undefined): string[] {
  const extra = previous && previous.photos !== after.photos ? rawPhotos(previous) : {};
  if (before.photos === after.photos && Object.keys(extra).length === 0) return [];
  const was = rawPhotos(before);
  const now = rawPhotos(after);
  const ids = new Set([...Object.keys(was), ...Object.keys(extra), ...Object.keys(now)]);
  return [...ids].filter((id) =>
    id in now ? was[id] !== now[id] && !sameJsonValue(was[id], now[id]) : true,
  );
}

const isPhotoIds = (v: unknown): v is string[] =>
  Array.isArray(v) &&
  v.length <= MAX_PAGE_STEPS &&
  v.every((id) => typeof id === 'string' && id.length > 0 && id.length <= MAX_PAGE_ID);

/** A request's changes read defensively; null when nothing is readable (the tab is then stored as sent). */
export function parseTabSaveChanges(v: Record<string, unknown> | null): TabSaveChanges | null {
  if (!v) return null;
  const out: TabSaveChanges = {};
  const pages = parsePageSteps(v.pages);
  if (pages) out.pages = pages;
  if (isPhotoIds(v.photos)) out.photos = v.photos;
  return out.pages || out.photos ? out : null;
}

/** The tab a save stores: `saved` as sent, with its pages merged over `stored` by the save's page steps and held to
 *  the page caps, and its pictures merged by page. A page or picture the save did not change keeps the stored copy, a
 *  peer's one the save never saw stays, and what it removed goes; a picture whose page the merged tab lacks goes. */
export function mergeSaveOverStored(stored: Tab, saved: Tab, changes: TabSaveChanges): Tab {
  const out: Tab = { ...saved };
  const pages = savedPagesOver(stored, saved, changes.pages, readPages, PAGE_CAPS);
  if (pages === undefined) delete out.pages;
  else out.pages = pages as Tab['pages'];
  const photos = mergedPhotos(stored, saved, changes.photos, out);
  if (photos) out.photos = photos as Tab['photos'];
  else delete out.photos;
  return out;
}

// The pictures stored: the stored ones, with the save's changed ones over them (each one the saved tab lacks
// removed). Without named changes (a header that named none), every saved picture over the stored ones.
function mergedPhotos(
  stored: Tab,
  saved: Tab,
  changed: readonly string[] | undefined,
  merged: Tab,
): Record<string, unknown> | undefined {
  const fromSave = rawPhotos(saved);
  const out: Record<string, unknown> = { ...rawPhotos(stored) };
  for (const id of changed ?? Object.keys(fromSave)) {
    if (id in fromSave) out[id] = fromSave[id];
    else delete out[id];
  }
  const shown = new Set(pagesOf(merged).map((p) => p.id));
  for (const id of Object.keys(out)) if (!shown.has(id)) delete out[id];
  return Object.keys(out).length > 0 ? out : undefined;
}
