// What one tab save changed, by id (docs/specs/012-collaboration/collab-race-hardening.md "A save is merged with the
// stored tab"): its page steps. The editor sends them beside the whole tab (`X-Save-Changes`,
// @liveworkspace/api-schema/tab-save-changes), and the api applies them over the tab it has stored, so two Editors
// adding a page at the same moment both keep it after a reload (Work Tracker #669). Elements are not here: they
// have the changeset merge and the room's ledger.
import type { IdListStep } from '@liveworkspace/model-core/id-list-steps';
import {
  pagesWithSteps,
  parsePageSteps,
  savedPagesOver,
  tabPageSteps,
} from '@liveworkspace/model-core/tab-page-steps';
import { pagesOf, type Page } from './page';
import type { Tab } from './index';

export type TabSaveChanges = { pages?: IdListStep[] };

const readPages = (tab: { pages?: unknown } | undefined) => pagesOf(tab);

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
  return pagesWithSteps(local, read, readPages({ pages: sent }), readPages);
}

/** The changes from `before` (the save baseline) to `after` (the tab saved). `previous` is this editor's last save
 *  of the tab while it may still be in flight: a page it held that `after` lacks is removed too. */
export function tabSaveChanges(before: Tab, after: Tab, previous?: Tab): TabSaveChanges {
  return { pages: pageStepsOf(before, after, previous) };
}

/** A request's changes read defensively; null when nothing is readable (the tab is then stored as sent). */
export function parseTabSaveChanges(v: Record<string, unknown> | null): TabSaveChanges | null {
  const pages = v ? parsePageSteps(v.pages) : null;
  return pages ? { pages } : null;
}

/** The tab a save stores: `saved` as sent, with its pages merged over `stored` by the save's page steps. A page the
 *  save did not change keeps the stored copy, a peer's page the save never saw stays, and what it removed goes. */
export function mergeSaveOverStored(stored: Tab, saved: Tab, changes: TabSaveChanges): Tab {
  const out: Tab = { ...saved };
  const pages = savedPagesOver(stored, saved, changes.pages, readPages);
  if (pages === undefined) delete out.pages;
  else out.pages = pages as Tab['pages'];
  return out;
}
