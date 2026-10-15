// A mind map built from an outline (docs/specs/009-elements/mind-node.md "Templates"): mind nodes carrying their
// parent pointers and the root's flow, laid out by the same `layoutMindTree` keyboard growth uses, so the result is
// a live, tidy map (Tab and Enter grow it in place) rather than a picture of one. The mind-map templates and graph
// input's mindmap style (docs/specs/015-api/mcp-server.md §4.7) both build with it.

import { createPinnedArrow } from './factories';
import { createShape } from './shape-factory';
import { layoutMindTree } from './mind-layout';
import { MIND_CONNECTOR_LOOK, mindConnectorAnchors, type MindFlow } from './mind-flow';
import type { ArrowElement, Element, ShapeElement } from './index';

/** One node of a template map: its label, its look, the look of the connector
 *  into it (a branch's colour, say), and what hangs off it. */
export type MindSpec = {
  label: string;
  look: Partial<ShapeElement> & { width: number; height: number };
  connector?: Partial<ArrowElement>;
  children?: MindSpec[];
};

export function buildMindTemplate(
  spec: MindSpec,
  flow: MindFlow,
  cx: number,
  cy: number,
): Element[] {
  const nodes: ShapeElement[] = [];
  const connectorLook = new Map<string, Partial<ArrowElement>>();
  const make = (s: MindSpec, parentId?: string): ShapeElement => {
    // Every node starts centred on the origin, so the layout reads sibling
    // order from the outline (a tie on position falls back to document order)
    // rather than from wherever a builder happened to put them.
    const el: ShapeElement = {
      ...(createShape('mind-node', 0, 0) as ShapeElement),
      ...s.look,
      label: s.label,
      x: -s.look.width / 2,
      y: -s.look.height / 2,
      ...(parentId ? { mindParentId: parentId } : { mindFlow: flow }),
    };
    nodes.push(el);
    if (s.connector) connectorLook.set(el.id, s.connector);
    for (const c of s.children ?? []) make(c, el.id);
    return el;
  };
  const root = make(spec);
  // Every node starts at the centre, so a balanced map has no sides to read yet: its branches are dealt out to
  // whichever side has less, in order, as switching to balanced deals them (read in tree order).
  const layout = layoutMindTree(
    nodes,
    root.id,
    flow,
    undefined,
    flow === 'balanced' ? 'tree' : flow,
  );
  const placed = nodes.map((n) => ({ ...n, ...layout.get(n.id)! }));
  // Centre the whole map on the drop point. A whole-pixel shift keeps the
  // layout exact, so the template still reads as tidy and grows tidily.
  const left = Math.min(...placed.map((n) => n.x));
  const right = Math.max(...placed.map((n) => n.x + n.width));
  const top = Math.min(...placed.map((n) => n.y));
  const bottom = Math.max(...placed.map((n) => n.y + n.height));
  const dx = Math.round(cx - (left + right) / 2);
  const dy = Math.round(cy - (top + bottom) / 2);
  const shifted = placed.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy }));
  const byId = new Map(shifted.map((n) => [n.id, n]));
  const arrows = shifted.flatMap((child) => {
    const parent = child.mindParentId ? byId.get(child.mindParentId) : undefined;
    if (!parent) return [];
    const [from, to] = mindConnectorAnchors(flow, parent, child);
    return [
      {
        ...createPinnedArrow(parent.id, from, child.id, to),
        ...MIND_CONNECTOR_LOOK,
        ...connectorLook.get(child.id),
      },
    ];
  });
  return [...arrows, ...shifted];
}

export type MindHue = { fill: string; stroke: string; text: string; leaf: string };

// A branch's hue: its card tint, its border and connector, its text, and the edge of its leaves.
export const MIND_HUES: readonly MindHue[] = [
  { fill: '#d1fae5', stroke: '#10b981', text: '#065f46', leaf: '#6ee7b7' },
  { fill: '#e0f2fe', stroke: '#0ea5e9', text: '#075985', leaf: '#7dd3fc' },
  { fill: '#ede9fe', stroke: '#8b5cf6', text: '#5b21b6', leaf: '#c4b5fd' },
  { fill: '#fef3c7', stroke: '#f59e0b', text: '#92400e', leaf: '#fcd34d' },
  { fill: '#ffe4e6', stroke: '#f43f5e', text: '#9f1239', leaf: '#fda4af' },
];
