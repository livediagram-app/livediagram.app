// This Browser's filter lens (livediagram/docs/specs/013-workspace/explorer-filters.md "Views"): the index never
// sees what is kept only in this browser, so the Explorer narrows the list itself, with the same compiled lens it
// runs over a row the reader just changed. Pure: the pane hands in the list and the parsed lens.

import type { App } from '@liveworkspace/index-client';
import { compileLens, isLensSet, thisBrowserSubject, type Lens, type LensSubject } from '../lens';
import type { ThisBrowserItem } from '../this-browser';

/** Every item as the lens reads it, for the field's "No matches" marks (the list is always whole). */
export function thisBrowserSubjects(
  items: readonly ThisBrowserItem[],
  app: App,
): readonly LensSubject[] {
  return items.map((item) => thisBrowserSubject(item, app));
}

/** The items the lens matches, in their order; all of them when it is unset. One compile, one pass. */
export function narrowThisBrowser(
  items: readonly ThisBrowserItem[],
  lens: Lens,
  app: App,
  now: number,
): readonly ThisBrowserItem[] {
  if (!isLensSet(lens)) return items;
  const matches = compileLens(lens, now);
  return items.filter((item) => matches(thisBrowserSubject(item, app)));
}
