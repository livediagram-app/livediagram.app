// An element's catalogue keys that are not text, dropped where stored elements enter (./stored-elements): from
// storage, a peer, a paste, a file or an agent's write. An icon's `iconId`, a sticker's `stickerId` and a flowchart
// step's `flowchartId` are looked up and compared as text all over the canvas and its exports (an emoji icon is
// told by its `emoji-` prefix), so a number or a list in one threw while the canvas rendered. Without it the
// element reads as it does with a key this build does not know: an icon its placeholder glyph, a sticker nothing,
// a shape no flowchart step (docs/specs/010-palette/technology-icons.md "iconId stays a plain string").

import type { Element } from './index';

/** The longest catalogue key an element carries: far past any real id. */
export const ELEMENT_KEY_MAX = 256;

/** The fields that hold a catalogue key. */
export const ELEMENT_KEY_FIELDS = ['iconId', 'stickerId', 'flowchartId'] as const;

/** Whether a value is a catalogue key: text of at most ELEMENT_KEY_MAX characters. */
export function isElementKey(v: unknown): v is string {
  return typeof v === 'string' && v.length <= ELEMENT_KEY_MAX;
}

/** The elements with every malformed catalogue key taken off; the same array when none had one. */
export function dropMalformedIds(elements: Element[]): Element[] {
  let out: Element[] | null = null;
  elements.forEach((el, i) => {
    const raw = el as unknown as Record<string, unknown>;
    const bad = ELEMENT_KEY_FIELDS.filter((k) => raw[k] !== undefined && !isElementKey(raw[k]));
    if (bad.length === 0) return;
    const next = { ...raw };
    for (const k of bad) delete next[k];
    out ??= elements.slice();
    out[i] = next as unknown as Element;
  });
  return out ?? elements;
}
