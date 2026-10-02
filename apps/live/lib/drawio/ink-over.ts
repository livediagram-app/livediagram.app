// Text laid over a shape (docs/specs/020-import-export/drawio-import.md "Legible labels on own fills",
// blueprint step 15.8). draw.io groups a title onto a note or a label onto a panel as a separate text
// cell, drawn on that shape rather than on the canvas:
// - on an empty note, the text becomes the note's own words (a livediagram note shows its "Note"
//   hint until it has some, so a text on top would collide with it);
// - on any other filled shape, a text with no colour of its own takes the ink that reads on its fill.
// The holder is the nearest boxed element below the text, in paint order, that holds it wholly.

import {
  isBoxed,
  type BoxedElement,
  type Element,
  type Endpoint,
  type StickyElement,
  type TextElement,
} from '@livediagram/document';
import { debugLog } from '@/lib/debug-log';
import { inkOnFill } from './vertex-props';

const holds = (outer: BoxedElement, inner: BoxedElement) =>
  outer.x <= inner.x &&
  outer.y <= inner.y &&
  outer.x + outer.width >= inner.x + inner.width &&
  outer.y + outer.height >= inner.y + inner.height;

const ownFill = (el: BoxedElement): string | undefined => {
  const fill = (el as { fillColor?: string }).fillColor;
  return fill && fill.startsWith('#') ? fill : undefined;
};

function holderOf(elements: Element[], i: number, el: TextElement): BoxedElement | null {
  for (let j = i - 1; j >= 0; j--) {
    const below = elements[j]!;
    if (isBoxed(below) && below.type !== 'text' && holds(below, el)) return below;
  }
  return null;
}

// The text's words and how they are set, carried onto the note; the note keeps its own colours
// unless the text chose one.
function wordsOnto(note: StickyElement, text: TextElement): StickyElement {
  const {
    id: _id,
    type: _type,
    x: _x,
    y: _y,
    width: _w,
    height: _h,
    fillColor: _f,
    ...style
  } = text as TextElement & { fillColor?: string };
  void [_id, _type, _x, _y, _w, _h, _f];
  const keep = Object.fromEntries(
    Object.entries(style).filter(([k]) => /^(label|richText|text|font)/.test(k)),
  );
  return {
    ...note,
    ...keep,
    ...(text.textColor ? {} : { textColor: note.textColor }),
  } as StickyElement;
}

const repoint = (end: Endpoint, from: string, to: string): Endpoint =>
  end.kind === 'pinned' && end.elementId === from ? { ...end, elementId: to } : end;

/** The elements with text laid on shapes resolved: notes take their words, fills lend their ink. */
export function inkOverFills(elements: Element[]): Element[] {
  const out = [...elements];
  const merged = new Map<string, string>();
  for (let i = 0; i < out.length; i++) {
    const el = out[i]!;
    if (el.type !== 'text' || !el.label) continue;
    const holder = holderOf(out, i, el);
    if (!holder) continue;
    if (holder.type === 'sticky' && !holder.label) {
      out[out.indexOf(holder)] = wordsOnto(holder, el);
      merged.set(el.id, holder.id);
      debugLog('[drawio-ink] text became its note', { text: el.id, note: holder.id });
      continue;
    }
    if (el.textColor) continue;
    const ink = inkOnFill(ownFill(holder));
    debugLog('[drawio-ink] text over fill', { id: el.id, ink: ink ?? 'theme' });
    if (ink) out[i] = { ...el, textColor: ink };
  }
  if (merged.size === 0) return out;
  return out
    .filter((el) => !merged.has(el.id))
    .map((el) => {
      if (el.type !== 'arrow') return el;
      let { from, to } = el;
      for (const [text, note] of merged) {
        from = repoint(from, text, note);
        to = repoint(to, text, note);
      }
      return from === el.from && to === el.to ? el : { ...el, from, to };
    });
}
