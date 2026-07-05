// Human-readable element naming, shared by the change log (spec/12)
// and the canvas accessibility layer (spec/71): aria-labels and live
// announcements read the same names the activity log prints, so the
// two surfaces can't drift. Lifted verbatim from lib/change-log.ts.

import type { BoxedElement, Element } from '@livediagram/diagram';

// Display kind for an element — capitalised, no article. Shapes
// surface their concrete sub-kind ('Square', 'Diamond'…) so log
// entries read as "Added a Square" rather than the abstract "Shape".
export function kindLabel(el: Element): string {
  if (el.type === 'arrow') return 'Arrow';
  if (el.type === 'text') return 'Text';
  if (el.type === 'sticky') return 'Sticky note';
  if (el.type === 'table') return 'Table';
  if (el.type === 'image') return 'Image';
  if (el.type === 'annotation') return 'Annotation';
  if (el.type === 'freehand') return 'Sketch';
  if (el.type === 'link-card') return 'Link card';
  if (el.type === 'shape') {
    const s = el.shape;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return 'Element';
}

export function article(label: string): 'a' | 'an' {
  return /^[aeiou]/i.test(label) ? 'an' : 'a';
}

export function pluralise(label: string): string {
  // 'Text' as a count noun ("2 texts") is awkward — promote to
  // "Text elements". Everything else: append 's'. Good enough for
  // V1; refine if a shape kind ends up needing irregular plural.
  if (label === 'Text') return 'Text elements';
  return `${label}s`;
}

// One-element description for verbs that act on a single target:
// "Added 'API'", "Added a Square", "Moved an Arrow". Quoted labels
// win when the element has one; otherwise we fall back to the
// articled kind.
export function describeOne(el: Element): string {
  // Tables + images don't carry a meaningful single label (a table's
  // content is in `cells`, not `label`), so naming them by label
  // produced nonsense like "Edited 'C'" after a cell edit. Name them
  // by kind ("a Table" / "an Image") instead. Arrows already opt out.
  if (el.type !== 'arrow' && el.type !== 'table' && el.type !== 'image') {
    const trimmed = ((el as BoxedElement).label ?? '').trim();
    if (trimmed) return `'${trimmed}'`;
  }
  const k = kindLabel(el);
  return `${article(k)} ${k}`;
}

// Multi-element description grouping by kind: "a Square & an Arrow",
// "3 Squares, 2 Arrows & a Circle". Order follows first-seen so the
// summary stays stable across renders.
export function describeMany(elements: Element[]): string {
  const counts = new Map<string, number>();
  for (const el of elements) {
    const k = kindLabel(el);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const parts: string[] = [];
  for (const [k, n] of counts) {
    parts.push(n === 1 ? `${article(k)} ${k}` : `${n} ${pluralise(k)}`);
  }
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} & ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} & ${parts[parts.length - 1]}`;
}

// The aria-label an element view carries (spec/71): the kind plus the
// quoted label when one exists — 'Square "Login"', 'Sticky note',
// 'Arrow "yes"'. Unlike describeOne this always leads with the kind,
// so a screen-reader user hears WHAT the thing is before its text.
export function elementAriaLabel(el: Element): string {
  const kind = kindLabel(el);
  const label = ('label' in el && typeof el.label === 'string' ? el.label : '').trim();
  return label ? `${kind} "${label}"` : kind;
}
