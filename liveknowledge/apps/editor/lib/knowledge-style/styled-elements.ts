// A page's drawings and charts in the knowledgebase's theme (docs/specs/030-knowledgebase/page-surface.md
// "Knowledgebase Style": "A drawing or chart inside a page takes the knowledgebase's theme"). A knowledgebase's
// elements are stored without theme colours (a tab has no theme of its own, and the product's own scheme paints
// none), so each colour an element leaves unset is the theme's when it is drawn, in the viewer's half; a colour
// someone picked is kept. Nothing is written: the stored element is untouched, so a style change redraws and saves
// no page. Cached per element, so an element that did not change keeps its drawn identity.
import {
  DEFAULT_SCHEME_ID,
  themeColourFields,
  type Appearance,
  type Element,
} from '@liveknowledge/document';
import { resolveTheme } from '@/lib/themes';

type Drawn = { key: string; out: Element };
const drawn = new WeakMap<Element, Drawn>();
let last: { from: Element[]; key: string; out: Element[] } | null = null;

export function elementsInTheme(
  elements: Element[],
  themeId: string | undefined,
  appearance: Appearance,
): Element[] {
  if (!themeId || themeId === DEFAULT_SCHEME_ID) return elements;
  const theme = resolveTheme(themeId, appearance);
  if (!theme) return elements;
  const key = `${themeId}:${appearance}`;
  if (last && last.from === elements && last.key === key) return last.out;
  let changed = false;
  const out = elements.map((el) => {
    const hit = drawn.get(el);
    if (hit && hit.key === key) {
      if (hit.out !== el) changed = true;
      return hit.out;
    }
    const patch: Record<string, string> = {};
    for (const { element, theme: slot } of themeColourFields(el)) {
      const value = theme[slot];
      if (value && (el as Record<string, unknown>)[element] === undefined) patch[element] = value;
    }
    const next: Element = Object.keys(patch).length ? { ...el, ...patch } : el;
    drawn.set(el, { key, out: next });
    if (next !== el) changed = true;
    return next;
  });
  last = { from: elements, key, out: changed ? out : elements };
  return last.out;
}
