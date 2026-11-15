// What changed between an earlier version of a tab and the tab as it is now (docs/specs/006-document/
// version-history.md "Opening a version"): by element id, the elements the version has that the tab no longer has
// (removed since), those both have that differ (changed since) and those the tab gained (added since); the pages
// either side lacks; and whether the articles' writing differs. The live fields (the conversation, not the content)
// never count. One pass over each side's elements: two 2,000-element tabs compare in about 3 ms (measured).
import { articlesOf } from './article-flow';
import { LIVE_ELEMENT_FIELDS } from './comments';
import { pagesOf } from './page';
import type { Element } from './element-union';
import type { Tab } from './tab-type';

export type VersionChanges = {
  removed: string[];
  changed: string[];
  added: string[];
  // Pages the tab has gained since the version, and pages it has lost.
  pagesAdded: number;
  pagesRemoved: number;
  writingChanged: boolean;
};

type Side = Pick<Tab, 'elements'> & {
  pages?: unknown;
  pageOrientation?: unknown;
  articles?: unknown;
};

const LIVE = new Set<string>(LIVE_ELEMENT_FIELDS);

// An element's content as text, without its conversation. Key order is the element's own: both sides come from the
// same writer, and a reordered key reads as a change at worst.
function contentOf(element: Element): string {
  return JSON.stringify(element, (key, value: unknown) => (LIVE.has(key) ? undefined : value));
}

export function versionChanges(version: Side, now: Side): VersionChanges {
  const current = new Map<string, Element>();
  for (const element of now.elements) current.set(element.id, element);
  const removed: string[] = [];
  const changed: string[] = [];
  const kept = new Set<string>();
  for (const element of version.elements) {
    const there = current.get(element.id);
    if (!there) {
      removed.push(element.id);
      continue;
    }
    kept.add(element.id);
    if (there !== element && contentOf(there) !== contentOf(element)) changed.push(element.id);
  }
  const added = now.elements.filter((e) => !kept.has(e.id)).map((e) => e.id);
  const versionPages = new Set(pagesOf(version).map((p) => p.id));
  const nowPages = new Set(pagesOf(now).map((p) => p.id));
  let pagesAdded = 0;
  let pagesRemoved = 0;
  for (const id of nowPages) if (!versionPages.has(id)) pagesAdded += 1;
  for (const id of versionPages) if (!nowPages.has(id)) pagesRemoved += 1;
  const writingChanged =
    version.articles !== now.articles &&
    JSON.stringify(articlesOf(version)) !== JSON.stringify(articlesOf(now));
  return { removed, changed, added, pagesAdded, pagesRemoved, writingChanged };
}

// "3 changed, 2 removed, 1 added · 1 page added · the writing changed", or null when nothing differs.
export function versionChangesLine(changes: VersionChanges): string | null {
  const counts = [
    changes.changed.length ? `${changes.changed.length} changed` : null,
    changes.removed.length ? `${changes.removed.length} removed` : null,
    changes.added.length ? `${changes.added.length} added` : null,
  ].filter(Boolean);
  const page = (n: number, what: string) => `${n} page${n === 1 ? '' : 's'} ${what}`;
  const parts = [
    counts.length ? counts.join(', ') : null,
    changes.pagesAdded ? page(changes.pagesAdded, 'added') : null,
    changes.pagesRemoved ? page(changes.pagesRemoved, 'removed') : null,
    changes.writingChanged ? 'the writing changed' : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
