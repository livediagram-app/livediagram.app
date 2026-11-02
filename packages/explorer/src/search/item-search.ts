// What an editor's own Search panel needs to find work in every app (README.md "Search panel", Work Tracker #63): the
// index's search, the app's mark (its logo in its colour) and its name, and which results it should list. Its own
// entry point (`@liveworkspace/explorer/item-search`), so an editor's lazily loaded panel takes only this.

import type { App, Item } from '@liveworkspace/index-client';
import { siteOf } from '../words';

export { useItemSearch, type ItemSearchState } from './useItemSearch';
export { AppMark } from '../explorer/badges';

/** At most this many results from every app in an editor's panel: a group like the others, not a list. */
export const EVERY_APP_MAX = 8;

/** An app's name ("liveplanner") and its colours, for the word beside a result: `deep` on a light ground (the accent
 *  is too pale for text there), `accent` on a dark one, as the apps' wordmarks do. */
export function appLabel(app: App): { name: string; accent: string; deep: string } {
  const site = siteOf(app);
  return { name: site.name, accent: site.accent, deep: site.deep };
}

/**
 * The index's results an editor's panel lists under Every App: those it does not already list from its own lists
 * (`shown`, its documents' ids), in the index's order, at most `max`. Linear in the results.
 */
export function everyAppResults(
  items: readonly Item[],
  shown: ReadonlySet<string>,
  max = EVERY_APP_MAX,
): Item[] {
  const out: Item[] = [];
  for (const item of items) {
    if (out.length >= max) break;
    if (!shown.has(item.id) && item.trashedAt === null) out.push(item);
  }
  return out;
}
