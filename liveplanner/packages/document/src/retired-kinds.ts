// Loading a tab that holds an element of a kind this build no longer has. A path (the Path tool's
// curve) was retired with Draw mode: nothing draws, edits or validates one, so a stored one would
// make every later save of its tab fail. It is dropped where stored elements enter (./stored-elements):
// from storage, a peer, a paste, a file or an agent's write. The tab's other elements are untouched.

import type { Element } from './index';

const RETIRED_ELEMENT_TYPES: ReadonlySet<string> = new Set(['path']);

const isRetired = (el: Element): boolean =>
  RETIRED_ELEMENT_TYPES.has((el as { type?: unknown }).type as string);

/** The elements without any of a retired kind; the same array when none was. */
export function dropRetiredKinds(elements: Element[]): Element[] {
  if (!elements.some(isRetired)) return elements;
  const kept = elements.filter((el) => !isRetired(el));
  console.info('[migrate] retired kinds dropped', { dropped: elements.length - kept.length });
  return kept;
}
