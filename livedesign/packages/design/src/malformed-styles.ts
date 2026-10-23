// An element's style fields of the wrong type, dropped where stored elements enter (./stored-elements): from
// storage, a peer, a paste, a file or an agent's write. The renderers look a padding, a corner, a border up by
// name and do arithmetic with a rotation or an opacity, so `padding: 12` drew the label at x = NaN (gone), and
// `opacity: "50%"` or `shadow: true` put NaN into the drawing. Without the field the element draws with its
// default, as one that never set it does.
//
// Only the TYPE is checked, never the value: a padding or a border this build does not know (a newer build's) is
// still text and passes, so an older browser never drops what a newer one wrote (docs/specs/006-design/
// design-structure.md "Styles have their types").

import type { Element } from './index';
import { isRecord } from './is-record';

const isText = (v: unknown) => typeof v === 'string';
const isNumber = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
// A text size is a preset's name or a size in px.
const isTextSizeLike = (v: unknown) => isText(v) || isNumber(v);
// A shadow is its offsets, blur and strength (./shadow).
const isShadowLike = (v: unknown) =>
  isRecord(v) &&
  isNumber(v.offsetX) &&
  isNumber(v.offsetY) &&
  isNumber(v.blur) &&
  isNumber(v.opacity);

// Each style field and the type it holds on every element. An arrow's stroke width is px; every other element's is
// a named border weight.
const STYLE_TYPES: readonly [string, (v: unknown, el: Element) => boolean][] = [
  ['padding', isText],
  ['borderRadius', isText],
  ['strokeStyle', isText],
  ['textAlignX', isText],
  ['textAlignY', isText],
  ['textSize', isTextSizeLike],
  ['rotation', isNumber],
  ['opacity', isNumber],
  ['shadow', isShadowLike],
  ['strokeWidth', (v, el) => (el.type === 'arrow' ? isNumber(v) : isText(v))],
];

/** The elements with every style field of the wrong type taken off; the same array when none had one. */
export function dropMalformedStyles(elements: Element[]): Element[] {
  let out: Element[] | null = null;
  elements.forEach((el, i) => {
    const raw = el as unknown as Record<string, unknown>;
    const bad = STYLE_TYPES.filter(([k, ok]) => raw[k] !== undefined && !ok(raw[k], el));
    if (bad.length === 0) return;
    const next = { ...raw };
    for (const [k] of bad) delete next[k];
    out ??= elements.slice();
    out[i] = next as unknown as Element;
  });
  return out ?? elements;
}
