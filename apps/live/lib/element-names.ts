// Human-readable element naming for the canvas accessibility layer
// (docs/specs/004-interface-design/canvas-accessibility.md) and the other surfaces that name an element:
// aria-labels and live announcements read the same names everywhere, so
// they can't drift.

import {
  CHART_TYPE_LABELS,
  chartTypeOf,
  type BoxedElement,
  type Element,
} from '@livediagram/document';

// Display kind for an element — capitalised, no article. Shapes
// surface their concrete sub-kind ('Square', 'Diamond'…) so a name
// reads as "Square" rather than the abstract "Shape".
export function kindLabel(el: Element): string {
  if (el.type === 'arrow') return 'Arrow';
  if (el.type === 'text') return 'Text';
  if (el.type === 'sticky') return 'Sticky note';
  if (el.type === 'table') return 'Table';
  if (el.type === 'image') return 'Image';
  if (el.type === 'annotation') return 'Annotation';
  if (el.type === 'freehand') {
    // The marker pen (docs/specs/008-canvas/highlighter.md) and the polygon tool (docs/specs/008-canvas/polygon-tool.md) both
    // commit FreehandElements; name them by what the user drew.
    if (el.pen === 'highlighter') return 'Highlight';
    if (el.straightEdges) return el.closed ? 'Polygon' : 'Polyline';
    return 'Sketch';
  }
  if (el.type === 'path') return 'Path';
  if (el.type === 'link-card') return 'Link card';
  if (el.type === 'video') return 'Embed';
  if (el.type === 'shape') {
    // A chart is named by its chart type, as the palette names it: 'Column chart', not its kind's 'Bar chart'.
    const chart = chartTypeOf(el);
    return chart ? `${CHART_TYPE_LABELS[chart]} chart` : shapeKindLabel(el.shape);
  }
  return 'Element';
}

/** A shape kind as prose: hyphenated kinds read as words ('pie-chart' → 'Pie chart'). */
export function shapeKindLabel(kind: string): string {
  const s = kind.split('-').join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function article(label: string): 'a' | 'an' {
  return /^[aeiou]/i.test(label) ? 'an' : 'a';
}

function pluralise(label: string): string {
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

// What a selection announcement names one element by (docs/specs/004-interface-design/canvas-accessibility.md
// "Live announcements"): describeOne, and for an arrow pinned to labelled elements what it joins, "an Arrow from
// 'Travel' to 'Hotel'", so walking a mind map's or a flowchart's connectors says where each one runs. An end
// left free, or on an element with no label, is left out.
export function describeSelected(el: Element, elements: readonly Element[]): string {
  const one = describeOne(el);
  if (el.type !== 'arrow') return one;
  const endName = (end: (typeof el)['from']): string | null => {
    if (end.kind !== 'pinned') return null;
    const target = elements.find((x) => x.id === end.elementId);
    return target && target.type !== 'arrow' && target.type !== 'table' && target.type !== 'image'
      ? ((target as BoxedElement).label ?? '').replace(/\s+/g, ' ').trim() || null
      : null;
  };
  const label = (el.label ?? '').trim();
  const from = endName(el.from);
  const to = endName(el.to);
  return [one, label ? `'${label}'` : '', from ? `from '${from}'` : '', to ? `to '${to}'` : '']
    .filter(Boolean)
    .join(' ');
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

// The aria-label an element view carries (docs/specs/004-interface-design/canvas-accessibility.md): the kind plus the
// quoted label when one exists — 'Square "Login"', 'Sticky note',
// 'Arrow "yes"'. Unlike describeOne this always leads with the kind,
// so a screen-reader user hears WHAT the thing is before its text.
export function elementAriaLabel(el: Element): string {
  // A path is read by its points (docs/specs/023-draw-mode/path-tool.md "Accessibility").
  if (el.type === 'path') {
    return `${el.closed ? 'Closed path' : 'Path'}, ${el.nodes.length} points`;
  }
  const kind = kindLabel(el);
  const label = ('label' in el && typeof el.label === 'string' ? el.label : '').trim();
  return label ? `${kind} "${label}"` : kind;
}
