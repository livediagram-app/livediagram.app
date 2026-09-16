// Elements -> Mermaid flowchart text (spec/73). The export direction, lifted
// out of ./mermaid, which held both directions in 566 lines. Parsing stays
// there; the two share only the shape vocabulary and read in opposite
// directions, so they are separate concerns that happened to live together.
//
// Named for the family already here: ./mermaid-shared, ./mermaid-er,
// ./mermaid-state.
import { ARROW_THICKNESS_PX } from './arrow-style';
import type { ArrowElement, Element, ElementLink } from './index';
import { visibleLayerElements, type Layer } from './layers';

// Our shape kind -> the Mermaid bracket to emit on export. Kinds without a
// natural flowchart shape fall back to the square box.
const SHAPE_TO_BRACKET: Record<string, [string, string]> = {
  square: ['["', '"]'],
  stadium: ['(["', '"])'],
  circle: ['(("', '"))'],
  diamond: ['{"', '"}'],
  cylinder: ['[("', '")]'],
  hexagon: ['{{"', '"}}'],
  parallelogram: ['[/"', '"/]'],
  trapezoid: ['[/"', '"\\]'],
};

// Element label -> Mermaid quoted-label text. `&` first so the entities it
// introduces aren't double-escaped; newlines become <br/>.
function escapeLabel(label: string): string {
  return label.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/\n/g, '<br/>');
}

// Mermaid ids must be plain tokens; map our arbitrary element ids to n1, n2…
// deterministically by first appearance.
function mermaidNodeText(id: string, label: string, shape: string): string {
  const [open, close] = SHAPE_TO_BRACKET[shape] ?? SHAPE_TO_BRACKET.square!;
  return `${id}${open}${escapeLabel(label)}${close}`;
}

// The connection operator an arrow's real stroke/ends/head fields spell.
// Dashed wins over thick (Mermaid has no dashed-thick stroke); a circle head
// swaps the terminal for `o`. Head-at-from arrows are emitted with their
// endpoints swapped instead (the caller handles the swap).
function edgeOperator(a: ArrowElement, ends: 'to' | 'none' | 'both'): string {
  const dashed = a.strokeStyle !== undefined && a.strokeStyle !== 'solid';
  const thick = !dashed && (a.strokeWidth ?? 0) >= ARROW_THICKNESS_PX.thick;
  const circle = a.arrowheadShape === 'circle' || a.arrowheadShape === 'circle-hollow';
  const body = dashed ? '-.-' : thick ? '==' : '--';
  if (ends === 'none') return dashed ? '-.-' : thick ? '===' : '---';
  const headChar = circle ? 'o' : '>';
  const lead = ends === 'both' ? (circle ? 'o' : '<') : '';
  return `${lead}${body}${headChar}`;
}

type BoxedShape = Element & {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  shape?: string;
  link?: ElementLink;
};

export function mermaidFromTab(tab: { elements: Element[]; layers?: Layer[] }): string {
  // Hidden layers drop out of the export (spec/74): what you see on the
  // canvas is what the flowchart describes. Arrows on hidden layers (or
  // touching hidden nodes) vanish with them, since a hidden node never
  // enters the id map below.
  const elements = visibleLayerElements(tab.elements, tab.layers);
  const boxed = elements.filter((e): e is BoxedShape => e.type === 'shape' && 'x' in e);
  const frames = boxed.filter((e) => e.shape === 'frame');
  const nodes = boxed.filter((e) => e.shape !== 'frame');

  const idMap = new Map<string, string>();
  nodes.forEach((el, i) => idMap.set(el.id, `n${i + 1}`));
  frames.forEach((el, i) => idMap.set(el.id, `s${i + 1}`));

  // A node belongs to the smallest frame containing its centre — one level,
  // matching what the import produces.
  const frameOf = new Map<string, string>();
  for (const n of nodes) {
    const cx = n.x + n.width / 2;
    const cy = n.y + n.height / 2;
    let best: BoxedShape | null = null;
    for (const f of frames) {
      const inside = cx >= f.x && cx <= f.x + f.width && cy >= f.y && cy <= f.y + f.height;
      if (inside && (best === null || f.width * f.height < best.width * best.height)) best = f;
    }
    if (best) frameOf.set(n.id, best.id);
  }

  const nodeLine = (el: BoxedShape, indent: string) => {
    const mid = idMap.get(el.id)!;
    const label = (el.label ?? '').trim() || mid;
    return `${indent}${mermaidNodeText(mid, label, el.shape ?? 'square')}`;
  };

  const lines: string[] = ['flowchart TD'];
  for (const f of frames) {
    const sid = idMap.get(f.id)!;
    const title = (f.label ?? '').trim() || sid;
    lines.push(`  subgraph ${sid}["${escapeLabel(title)}"]`);
    for (const n of nodes) if (frameOf.get(n.id) === f.id) lines.push(nodeLine(n, '    '));
    lines.push('  end');
  }
  for (const n of nodes) if (!frameOf.has(n.id)) lines.push(nodeLine(n, '  '));

  for (const el of elements) {
    if (el.type !== 'arrow') continue;
    let from = el.from.kind === 'pinned' ? idMap.get(el.from.elementId) : undefined;
    let to = el.to.kind === 'pinned' ? idMap.get(el.to.elementId) : undefined;
    if (!from || !to) continue; // free / on-arrow endpoints have no node to name
    let ends: 'to' | 'none' | 'both';
    const rawEnds = el.arrowEnds ?? 'to';
    if (rawEnds === 'from') {
      // Head at the from end: Mermaid has no lone back-arrow, so swap the
      // endpoints — same picture, same graph.
      [from, to] = [to, from];
      ends = 'to';
    } else {
      ends = rawEnds;
    }
    const op = edgeOperator(el, ends);
    const label = typeof el.label === 'string' ? el.label.trim() : '';
    lines.push(`  ${from} ${op}${label ? `|${escapeLabel(label)}|` : ''} ${to}`);
  }

  // URL element links round-trip as `click` lines (spec/73). Other link
  // kinds (tab / element / diagram) are livediagram-internal and have no
  // Mermaid meaning.
  for (const n of nodes) {
    if (n.link?.kind === 'url') {
      lines.push(`  click ${idMap.get(n.id)!} "${n.link.url.replace(/"/g, '%22')}"`);
    }
  }
  return lines.join('\n') + '\n';
}
