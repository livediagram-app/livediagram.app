// Arrows as views print them (docs/specs/024-agents/blueprints/document-views.md "Edges", VW26, VW27):
// on their source's line when pinned to a printed element there, else on their own line.
import type { ArrowElement, Element, Endpoint, RefTable } from '@livediagram/document';
import type { ViewEdgeJson, ViewEnd } from '@livediagram/api-schema';
import { LABEL_CUT_CHARS } from './constants';
import { textField } from './fields';
import { attrValue, jsonString } from './text';

export type ViewEdge = {
  arrow: ArrowElement;
  index: number;
  ref: string;
  from: ViewEnd;
  to: ViewEnd;
  label: string | null;
  style: string[];
};

export type Edges = {
  // Each source element's outgoing arrows, in array order.
  bySource: ReadonlyMap<string, ViewEdge[]>;
  // Arrows without a printed source, in array order.
  ownLine: ViewEdge[];
  // Every printed arrow, in array order.
  all: ViewEdge[];
  // Every printed arrow by its id.
  byArrow: ReadonlyMap<string, ViewEdge>;
};

function endOf(end: Endpoint, refs: RefTable): ViewEnd {
  switch (end.kind) {
    case 'pinned':
      return { ref: refs.refOf(end.elementId) };
    case 'on-arrow':
      return { arrow: refs.refOf(end.arrowId) };
    default:
      return { free: { x: end.x, y: end.y } };
  }
}

export function endText(end: ViewEnd): string {
  if ('ref' in end) return end.ref;
  if ('arrow' in end) return `arrow:${end.arrow}`;
  return 'free';
}

function styleMarks(arrow: ArrowElement): string[] {
  const marks: string[] = [];
  if (arrow.strokeStyle !== undefined && arrow.strokeStyle !== 'solid')
    marks.push(arrow.strokeStyle);
  if (arrow.arrowEnds !== undefined && arrow.arrowEnds !== 'to') marks.push(arrow.arrowEnds);
  return marks;
}

export function edgesOf(
  printed: readonly Element[],
  refs: RefTable,
  nodeIds: ReadonlySet<string>,
): Edges {
  const bySource = new Map<string, ViewEdge[]>();
  const ownLine: ViewEdge[] = [];
  const all: ViewEdge[] = [];
  printed.forEach((el, index) => {
    if (el.type !== 'arrow') return;
    const edge: ViewEdge = {
      arrow: el,
      index,
      ref: refs.refOf(el.id),
      from: endOf(el.from, refs),
      to: endOf(el.to, refs),
      label: textField(el, 'label'),
      style: styleMarks(el),
    };
    all.push(edge);
    const source =
      el.from.kind === 'pinned' && nodeIds.has(el.from.elementId) ? el.from.elementId : null;
    if (source === null) ownLine.push(edge);
    else bySource.set(source, [...(bySource.get(source) ?? []), edge]);
  });
  return { bySource, ownLine, all, byArrow: new Map(all.map((edge) => [edge.arrow.id, edge])) };
}

// ` "label" ~dashed ~both`, then any extra `key=value` text: what follows an end.
export function edgeTail(edge: ViewEdge, extra: readonly string[] = []): string {
  const label = edge.label === null ? '' : ` ${jsonString(edge.label, LABEL_CUT_CHARS)}`;
  const marks = edge.style.map((mark) => ` ~${attrValue(mark)}`).join('');
  return `${label}${marks}${extra.map((t) => ` ${t}`).join('')}`;
}

// An edge on its source's line: `target "label" ~style`.
export function edgeText(edge: ViewEdge, extra: readonly string[] = []): string {
  return `${endText(edge.to)}${edgeTail(edge, extra)}`;
}

// An arrow on its own line: `arrow ref from → to "label" ~style`.
export function ownLineText(edge: ViewEdge, extra: readonly string[] = []): string {
  return `arrow ${edge.ref} ${endText(edge.from)} → ${edgeText(edge, extra)}`;
}

export function edgeJson(edge: ViewEdge): ViewEdgeJson {
  return {
    ref: edge.ref,
    id: edge.arrow.id,
    from: edge.from,
    to: edge.to,
    label: edge.label,
    style: edge.style,
  };
}
