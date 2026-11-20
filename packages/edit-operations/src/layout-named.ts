// A page layout by the name a caller gives it (each paged product's docs/specs/015-api/mcp-server.md "change_pages",
// "A layout by its plain name"). Layout ids carry their page kind as a prefix (slide-title, wf-settings,
// logo-wordmark), and a caller asking a slide for "title" was refused with the whole catalogue: a call spent to learn
// a prefix. The plain name is read as the layout it can only mean, and a miss names the closest.

import { editDistanceWithin } from './nearest';

// How near an id must be to be offered as closest, and how many are.
const CLOSEST_MAX_DISTANCE = 3;
const CLOSEST_MAX = 3;

const keyOf = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
// An id without its page kind's prefix: "slide-title" is "title"; an id of one word has none.
const plainOf = (id: string) => (id.includes('-') ? id.slice(id.indexOf('-') + 1) : id);

/** The layout `asked` names among `offered`: by id, else by the plain name one layout alone has; else the closest ids. */
export function layoutNamed<L extends { readonly id: string }>(
  offered: readonly L[],
  asked: string,
): { layout: L } | { layout: null; closest: string[] } {
  const key = keyOf(asked);
  const exact = offered.find((l) => l.id === key);
  if (exact) return { layout: exact };
  const plain = offered.filter((l) => plainOf(l.id) === key);
  if (plain.length === 1) return { layout: plain[0]! };
  const near = offered
    .map((l) => ({
      id: l.id,
      // A name the id holds whole is the nearest there is; else how far its plain name is.
      distance:
        key.length >= 3 && l.id.includes(key)
          ? 0
          : editDistanceWithin(key, plainOf(l.id), CLOSEST_MAX_DISTANCE),
    }))
    .filter((l) => l.distance <= CLOSEST_MAX_DISTANCE)
    .sort((a, b) => a.distance - b.distance);
  return { layout: null, closest: near.slice(0, CLOSEST_MAX).map((l) => l.id) };
}
