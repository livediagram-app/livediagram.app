// Tag colours (docs/specs/009-elements/tag-colours.md, blueprint tag-colours.md): a tab-level map from a card tag to a
// colour. A card with a mapped tag renders that colour as its accent edge and its chip tinted; nothing is stored on the
// card, so a retag or a new colour recolours every card at once.
//
// A LEAF module: types only from './index'.

import type { Element, ShapeElement } from './index';

export type TagColour = { tag: string; color: string };

/** The most tags a tab maps. */
export const TAG_COLOURS_MAX = 12;
/** How much of a tag's colour washes its chip (D191). */
export const TAG_CHIP_WASH = 0.16;
/** The longest tag the map keeps (a card's tag bound). */
export const TAG_COLOUR_TAG_MAX = 32;

const HEX = /^#[0-9a-f]{6}$/i;

/** What a tag matches on: trimmed, lower-cased. */
export function tagKey(tag: string): string {
  return tag.trim().toLowerCase();
}

/** The tab's map, read tolerantly: rows that do not parse are left out, and a repeated key keeps its first row. */
export function tagColoursOf(tab: { tagColours?: unknown }): TagColour[] {
  const raw = Array.isArray(tab.tagColours) ? tab.tagColours : [];
  const seen = new Set<string>();
  const out: TagColour[] = [];
  for (const r of raw) {
    if (typeof r !== 'object' || r === null) continue;
    const { tag, color } = r as Partial<TagColour>;
    if (typeof tag !== 'string' || typeof color !== 'string' || !HEX.test(color)) continue;
    const key = tagKey(tag);
    if (!key || key.length > TAG_COLOUR_TAG_MAX || seen.has(key)) continue;
    seen.add(key);
    out.push({ tag: tag.trim(), color });
    if (out.length === TAG_COLOURS_MAX) break;
  }
  return out;
}

/** The colour a tag is mapped to, else null. */
export function tagColourOf(map: readonly TagColour[] | undefined, tag: string): string | null {
  if (!map || map.length === 0) return null;
  const key = tagKey(tag);
  return map.find((r) => tagKey(r.tag) === key)?.color ?? null;
}

/** The tab with `tag` mapped to `color` (replacing its row, keeping the first casing), or unmapped on null. A blank tag,
 *  a colour that is not hex, or an add to a full map change nothing (the same object comes back). */
export function withTagColour<T extends { tagColours?: TagColour[] }>(
  tab: T,
  tag: string,
  color: string | null,
): T {
  const key = tagKey(tag);
  if (!key || key.length > TAG_COLOUR_TAG_MAX) return tab;
  if (color !== null && !HEX.test(color)) return tab;
  const map = tagColoursOf(tab);
  const at = map.findIndex((r) => tagKey(r.tag) === key);
  if (color === null) {
    if (at < 0) return tab;
    const next = map.filter((_, i) => i !== at);
    if (next.length > 0) return { ...tab, tagColours: next };
    const { tagColours: _gone, ...rest } = tab;
    return rest as T;
  }
  if (at >= 0) {
    if (map[at]!.color.toLowerCase() === color.toLowerCase()) return tab;
    return { ...tab, tagColours: map.map((r, i) => (i === at ? { tag: r.tag, color } : r)) };
  }
  if (map.length >= TAG_COLOURS_MAX) return tab;
  return { ...tab, tagColours: [...map, { tag: tag.trim(), color }] };
}

/** A card's tag colour: its first tag, in its own order, that the map colours. */
export function cardTagColour(
  el: ShapeElement,
  map: readonly TagColour[] | undefined,
): string | null {
  if (el.shape !== 'card' || !map || map.length === 0) return null;
  for (const tag of el.tags ?? []) {
    const c = tagColourOf(map, tag);
    if (c) return c;
  }
  return null;
}

/** The element as it renders under the map: a card with a tag colour takes it as its accent edge (its own side, else
 *  the left) unless it picked an edge colour of its own. Anything else comes back as the same object. */
export function withTagAccent<T extends Element>(el: T, map: readonly TagColour[] | undefined): T {
  if (el.type !== 'shape' || el.shape !== 'card') return el;
  const colour = cardTagColour(el, map);
  if (!colour) return el;
  return {
    ...el,
    accentEdge: el.accentEdge ?? 'left',
    accentEdgeColor: el.accentEdgeColor ?? colour,
  };
}
