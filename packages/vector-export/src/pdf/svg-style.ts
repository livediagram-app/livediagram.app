// An SVG element's painting properties (liveworkspace/docs/specs/013-export/vector-pdf.md "Paint"), read from the browser's computed style of
// the mounted SVG, which has every class, inline style, presentation attribute, inheritance and currentColor already
// resolved. Where nothing is computed (a DOM without a layout engine), the presentation attributes are read up the
// tree instead, with SVG's initial values.

const INHERITED: Record<string, string> = {
  fill: 'black',
  'fill-opacity': '1',
  'fill-rule': 'nonzero',
  stroke: 'none',
  'stroke-width': '1',
  'stroke-opacity': '1',
  'stroke-linecap': 'butt',
  'stroke-linejoin': 'miter',
  'stroke-miterlimit': '4',
  'stroke-dasharray': 'none',
  'stroke-dashoffset': '0',
  'clip-rule': 'nonzero',
  visibility: 'visible',
  'paint-order': 'normal',
};

const OWN: Record<string, string> = {
  opacity: '1',
  display: 'inline',
  'clip-path': 'none',
  mask: 'none',
  filter: 'none',
  'mix-blend-mode': 'normal',
  'stop-color': 'black',
  'stop-opacity': '1',
  overflow: 'visible',
};

// A CSS property name (the default tables are keyed by string).
export type StyleProp = string;

/** Reads one element's properties. */
export function styleOf(el: Element): (prop: StyleProp) => string {
  let cs: CSSStyleDeclaration | null = null;
  return (prop) => {
    cs ??= getComputedStyle(el);
    const computed = cs.getPropertyValue(prop).trim();
    if (computed) return computed;
    const inherited = prop in INHERITED;
    for (let e: Element | null = el; e; e = inherited ? e.parentElement : null) {
      const inline = (e as SVGElement).style?.getPropertyValue(prop).trim();
      if (inline) return inline;
      const attr = e.getAttribute(prop);
      if (attr !== null && attr !== 'inherit') return attr.trim();
    }
    return (inherited ? INHERITED[prop] : OWN[prop])!;
  };
}

/** A length as a number of user units ("2px", "2"); `fallback` for anything else. */
export function lengthOf(value: string, fallback: number): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

/** The id a `url(#id)` property points at, or null for none. */
export function refId(value: string): string | null {
  const v = value.trim();
  if (!v.startsWith('url(')) return null;
  const close = v.indexOf(')');
  const inner = v
    .slice(4, close === -1 ? v.length : close)
    .trim()
    .replace(/^["']|["']$/g, '');
  const hash = inner.indexOf('#');
  return hash === -1 ? null : inner.slice(hash + 1);
}
