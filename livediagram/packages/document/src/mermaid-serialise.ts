// Elements -> Mermaid flowchart text (docs/specs/020-import-export/mermaid.md). The export direction, lifted
// out of ./mermaid, which held both directions in 566 lines. Parsing stays
// there; the two share only the shape vocabulary and read in opposite
// directions, so they are separate concerns that happened to live together.
//
// Named for the family already here: ./mermaid-shared, ./mermaid-er,
// ./mermaid-state.
import { boxCentre, smallestHolder } from './containment';
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

// Our shape kinds with no bracket but a v11.3 attribute-form name the import reads back (mermaid.ts
// AT_SHAPE_NAMES), so a document or a triangle keeps its shape across a round trip.
const SHAPE_TO_AT_NAME: Record<string, string> = {
  document: 'doc',
  triangle: 'tri',
};

// Element label -> Mermaid quoted-label text. `&` first so the entities it
// introduces aren't double-escaped; newlines become <br/>. A `#` that would
// read as an entity code is itself written as one (`#35;`), and `%%` (a
// comment opener in an unquoted edge label) as `#37;#37;`, so every label
// round-trips. So are a backtick (`#96;`: a label wrapped in them read back as
// Mermaid's markdown string, its backticks and emphasis marks stripped) and the
// `<` of a `<br>` written as text (`#60;`: it read back as a line break).
function escapeLabel(label: string): string {
  return label
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/#(?=\d+;)/g, '#35;')
    .replace(/%%/g, '#37;#37;')
    .replace(/`/g, '#96;')
    .replace(/<(?=br\s*\/?>)/gi, '#60;')
    .replace(/\n/g, '<br/>');
}

// What an unlabelled node or frame is written with: one space, a label Mermaid accepts that reads back as none.
const BLANK_LABEL = ' ';

// Mermaid ids must be plain tokens; map our arbitrary element ids to n1, n2…
// deterministically by first appearance.
function mermaidNodeText(id: string, label: string, shape: string): string {
  const atName = SHAPE_TO_AT_NAME[shape];
  // The attribute form's body ends at the first `}`, so a label's own is written as its entity code.
  if (atName)
    return `${id}@{ shape: ${atName}, label: "${escapeLabel(label).replace(/\}/g, '#125;')}" }`;
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
  // Hidden layers drop out of the export (docs/specs/006-document/layers.md): what you see on the
  // canvas is what the flowchart describes. Arrows on hidden layers (or
  // touching hidden nodes) vanish with them, since a hidden node never
  // enters the id map below.
  const elements = visibleLayerElements(tab.elements, tab.layers);
  // Every connection is kept: an element an arrow is pinned to at both ends is a node for that arrow's sake, even a
  // kind with no flowchart meaning of its own (a text, a table), so the line is never dropped.
  const connected = new Set<string>();
  for (const el of elements) {
    if (el.type !== 'arrow' || el.from.kind !== 'pinned' || el.to.kind !== 'pinned') continue;
    connected.add(el.from.elementId);
    connected.add(el.to.elementId);
  }
  const boxed = elements.filter(
    (e): e is BoxedShape =>
      e.type !== 'arrow' &&
      'x' in e &&
      typeof (e as { width?: unknown }).width === 'number' &&
      (e.type === 'shape' || e.type === 'sticky' || connected.has(e.id)),
  );
  const frames = boxed.filter((e) => e.type === 'shape' && e.shape === 'frame');
  const nodes = boxed.filter((e) => !(e.type === 'shape' && e.shape === 'frame'));

  const idMap = new Map<string, string>();
  nodes.forEach((el, i) => idMap.set(el.id, `n${i + 1}`));
  frames.forEach((el, i) => idMap.set(el.id, `s${i + 1}`));

  // A node belongs to the smallest frame containing its centre — one level,
  // matching what the import produces.
  const frameOf = new Map<string, string>();
  for (const n of nodes) {
    const best = smallestHolder(boxCentre(n), frames);
    if (best) frameOf.set(n.id, best.id);
  }

  const nodeLine = (el: BoxedShape, indent: string) => {
    const mid = idMap.get(el.id)!;
    // No label is written blank, never as the id: the id came back as the label on import (a dot as a circle
    // reading "n18").
    const label = (el.label ?? '').trim() || BLANK_LABEL;
    const shape = el.type === 'shape' ? (el.shape ?? 'square') : 'square';
    return `${indent}${mermaidNodeText(mid, label, shape)}`;
  };

  const lines: string[] = ['flowchart TD'];
  for (const f of frames) {
    const sid = idMap.get(f.id)!;
    const title = (f.label ?? '').trim() || BLANK_LABEL;
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
    // `|` delimits the label, so one inside it is written as Mermaid's entity
    // code: raw, `yes|no` closed the label early and the rest parsed as a node.
    const edgeLabel = escapeLabel(label).replace(/\|/g, '#124;');
    lines.push(`  ${from} ${op}${label ? `|${edgeLabel}|` : ''} ${to}`);
  }

  // URL element links round-trip as `click` lines (docs/specs/020-import-export/mermaid.md). Other link
  // kinds (tab / element / document) are livediagram-internal and have no
  // Mermaid meaning.
  for (const n of nodes) {
    if (n.link?.kind === 'url') {
      lines.push(`  click ${idMap.get(n.id)!} "${n.link.url.replace(/"/g, '%22')}"`);
    }
  }
  return lines.join('\n') + '\n';
}
