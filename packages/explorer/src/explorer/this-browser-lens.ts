// This Browser's filter lens (livediagram/docs/specs/013-workspace/explorer-filters.md "Views"): the index never
// sees what is kept only in this browser, so the Explorer narrows the list itself, with the same compiled lens it
// runs over a row the reader just changed. Pure: the pane hands in the list and the parsed lens.

import type { App } from '@liveworkspace/index-client';
import { compileLens, isLensSet, thisBrowserSubject, type Lens, type LensSubject } from '../lens';
import type { ThisBrowserFolder, ThisBrowserItem } from '../this-browser';

/** The local folders the lens matches by name: every word in the name, ignoring case. A lens of filters alone (a kind,
 *  a date) is about items, so it leaves no folder; an unset lens leaves them all. */
export function narrowLocalFolders(
  folders: readonly ThisBrowserFolder[],
  lens: Lens,
): readonly ThisBrowserFolder[] {
  if (!isLensSet(lens)) return folders;
  if (lens.text.length === 0) return [];
  const words = lens.text.map((w) => w.toLocaleLowerCase());
  return folders.filter((f) => {
    const name = f.name.toLocaleLowerCase();
    return words.every((w) => name.includes(w));
  });
}

/** Each local folder's items, in the list's order (newest change first): one pass. */
export function itemsByFolder(
  items: readonly ThisBrowserItem[],
): ReadonlyMap<string, ThisBrowserItem[]> {
  const byFolder = new Map<string, ThisBrowserItem[]>();
  for (const item of items) {
    if (!item.folderId) continue;
    const list = byFolder.get(item.folderId);
    if (list) list.push(item);
    else byFolder.set(item.folderId, [item]);
  }
  return byFolder;
}

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
