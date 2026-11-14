// An element's catalogue keys that are not text, dropped where stored elements enter (./stored-elements): from
// storage, a peer, a paste, a file or an agent's write. An icon's `iconId` and a sticker's `stickerId` are looked up
// and compared as text all over the canvas and its exports (an emoji icon is told by its `emoji-` prefix), so a
// number or a list in one threw while the canvas rendered. Without it the element reads as it does with a key this
// build does not know: an icon its placeholder glyph, a sticker nothing
// (docs/specs/010-palette/technology-icons.md "iconId stays a plain string").

import type { Element } from './element';

/** The longest catalogue key an element carries: far past any real id. */
export const ELEMENT_KEY_MAX = 256;

/** The fields that hold a catalogue key. */
export const ELEMENT_KEY_FIELDS = ['iconId', 'stickerId'] as const;
/** The same in a product with flowcharts (livediagram, liveplanner): a flowchart step's `flowchartId` too, compared
 *  as text wherever the chart is read, so a shape with a malformed one reads as no flowchart step. */
export const FLOWCHART_ELEMENT_KEY_FIELDS = [...ELEMENT_KEY_FIELDS, 'flowchartId'] as const;

/** Whether a value is a catalogue key: text of at most ELEMENT_KEY_MAX characters. */
export function isElementKey(v: unknown): v is string {
  return typeof v === 'string' && v.length <= ELEMENT_KEY_MAX;
}

/** The elements with every malformed catalogue key taken off; the same array when none had one. */
export function dropMalformedIds<E extends Element>(elements: E[]): E[] {
  return dropMalformedKeys(elements, ELEMENT_KEY_FIELDS);
}

/** dropMalformedIds for a product with flowcharts. */
export function dropMalformedFlowchartIds<E extends Element>(elements: E[]): E[] {
  return dropMalformedKeys(elements, FLOWCHART_ELEMENT_KEY_FIELDS);
}

function dropMalformedKeys<E extends Element>(elements: E[], fields: readonly string[]): E[] {
  let out: E[] | null = null;
  elements.forEach((el, i) => {
    const raw = el as unknown as Record<string, unknown>;
    const bad = fields.filter((k) => raw[k] !== undefined && !isElementKey(raw[k]));
    if (bad.length === 0) return;
    const next = { ...raw };
    for (const k of bad) delete next[k];
    out ??= elements.slice();
    out[i] = next as unknown as E;
  });
  return out ?? elements;
}
