// Graph input's mindmap style (docs/specs/015-api/mcp-server.md §4.7): a real mind map, as the mind-map template
// draws one, not boxes on spokes. The root is the first node nothing enters (else the first node); the rest hang off
// it along the edges, breadth first. Mind nodes with parent pointers, laid out balanced (branches thrown both ways
// off the root, the classic hand-drawn map) by the editor's own mind layout, so the map grows with Tab and Enter.
// Three levels read apart: a bold round centre, first-level branches each tinted in their own hue with their icon,
// and white leaves edged in their branch's hue; connectors carry the branch hue and no arrowheads. An edge the tree
// leaves out (a cross-link) is drawn dashed between its two nodes.

import {
  edgeToArrow,
  glyphWidth,
  type GraphEdge,
  type GraphLook,
  type GraphNode,
} from './graph-authoring';
import { buildMindTemplate, MIND_HUES, type MindSpec } from './mind-template';
import { reanchorArrow, type Pt } from './auto-layout-shared';
import { isBoxed, type Element } from './index';

// Box sizes per level: the template's, widened for a longer label.
const ROOT_SIDE = 200;
const BRANCH = { width: 170, height: 64, max: 280, px: 22 };
const LEAF = { width: 160, height: 44, max: 260, px: 14 };

// The round root's side: big enough that its longest word fits one line of the circle's inner width (about 0.7 of
// it) and every line of its label fits down it, at the root's large text (32px), never under the template's 200.
const ROOT_PX = 32;
function rootSide(label: string): number {
  const words = label.split(/\s+/).filter(Boolean);
  const longest = Math.max(0, ...words.map((w) => glyphWidth(w, ROOT_PX)));
  let side = Math.max(ROOT_SIDE, Math.ceil(longest / 0.7 + 24));
  for (;;) {
    const lines = Math.ceil(glyphWidth(label, ROOT_PX) / (side * 0.7));
    if (lines * ROOT_PX * 1.25 <= side * 0.7 || side > 420) return side;
    side += 20;
  }
}

const fit = (label: string, lv: typeof BRANCH, iconRoom = 0) => {
  const w = Math.round(
    Math.min(lv.max, Math.max(lv.width, glyphWidth(label, lv.px) + 48 + iconRoom)),
  );
  const lines = Math.ceil((glyphWidth(label, lv.px) + iconRoom) / Math.max(1, w - 48));
  return { width: w, height: Math.max(lv.height, Math.round(lines * lv.px * 1.35 + 24)) };
};

export function layoutMindmapGraph(
  graph: { nodes: readonly (GraphNode & { icon?: string })[]; edges: readonly GraphEdge[] },
  opts: { look: GraphLook; makeEdgeId?: (() => string) | undefined },
): Element[] {
  const makeEdgeId = opts.makeEdgeId ?? (() => crypto.randomUUID());
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const entered = new Set(graph.edges.filter((e) => e.from !== e.to).map((e) => e.to));
  const root = graph.nodes.find((n) => !entered.has(n.id)) ?? graph.nodes[0];
  if (!root) return [];
  // The tree: breadth first from the root along edges either way.
  const children = new Map<string, string[]>();
  const seen = new Set([root.id]);
  const queue = [root.id];
  const treeEdges = new Set<string>();
  while (queue.length) {
    const at = queue.shift()!;
    for (const e of graph.edges) {
      const other = e.from === at ? e.to : e.to === at ? e.from : null;
      if (!other || seen.has(other) || !byId.has(other)) continue;
      seen.add(other);
      queue.push(other);
      (children.get(at) ?? children.set(at, []).get(at)!).push(other);
      treeEdges.add(`${e.from}->${e.to}`);
    }
  }
  // Nodes no edge reaches hang off the root, so nothing is lost.
  for (const n of graph.nodes)
    if (!seen.has(n.id))
      (children.get(root.id) ?? children.set(root.id, []).get(root.id)!).push(n.id);

  const leafSpec = (id: string, hue: (typeof MIND_HUES)[number]): MindSpec => {
    const n = byId.get(id)!;
    const label = n.label ?? '';
    return {
      label,
      look: {
        ...fit(label, LEAF, n.icon ? 30 : 0),
        textSize: 'sm',
        fillColor: '#ffffff',
        strokeColor: hue.leaf,
        textColor: '#334155',
        ...(n.icon ? { iconId: n.icon } : {}),
      },
      connector: { strokeColor: hue.leaf, strokeWidth: 2 },
      children: (children.get(id) ?? []).map((c) => leafSpec(c, hue)),
    };
  };
  const side = rootSide(root.label ?? '');
  const spec: MindSpec = {
    label: root.label ?? '',
    look: {
      width: side,
      height: side,
      textSize: 'lg',
      textBold: true,
      colorPreset: 'bold',
      borderRadius: 'full',
      ...(root.icon ? { iconId: root.icon, iconPosition: 'above' as const } : {}),
    },
    children: (children.get(root.id) ?? []).map((id, i) => {
      const n = byId.get(id)!;
      const hue = MIND_HUES[i % MIND_HUES.length]!;
      const label = n.label ?? '';
      return {
        label,
        look: {
          ...fit(label, BRANCH, n.icon ? 46 : 0),
          textSize: 'md',
          textBold: true,
          fillColor: hue.fill,
          strokeColor: hue.stroke,
          textColor: hue.text,
          strokeWidth: 'thick',
          ...(n.icon ? { iconId: n.icon } : {}),
        },
        connector: { strokeColor: hue.stroke, strokeWidth: 4 },
        children: (children.get(id) ?? []).map((c) => leafSpec(c, hue)),
      };
    }),
  };
  // The builder mints its own ids; map them back to the graph's by walking both trees in the same order.
  const built = buildMindTemplate(spec, 'balanced', 0, 0);
  const order: string[] = [];
  const walk = (id: string) => {
    order.push(id);
    for (const c of children.get(id) ?? []) walk(c);
  };
  walk(root.id);
  const nodes = built.filter(isBoxed);
  const rename = new Map(nodes.map((b, i) => [b.id, order[i] ?? b.id]));
  const renamed: Element[] = built.map((el) => {
    if (el.type === 'arrow') {
      const from =
        el.from.kind === 'pinned'
          ? { ...el.from, elementId: rename.get(el.from.elementId)! }
          : el.from;
      const to =
        el.to.kind === 'pinned' ? { ...el.to, elementId: rename.get(el.to.elementId)! } : el.to;
      return { ...el, id: makeEdgeId(), from, to };
    }
    const id = rename.get(el.id)!;
    return {
      ...el,
      id,
      ...('mindParentId' in el && el.mindParentId
        ? { mindParentId: rename.get(el.mindParentId) }
        : {}),
    } as Element;
  });
  // Cross-links: the edges the tree left out, dashed and curved.
  const centers = new Map<string, Pt>(
    renamed.filter(isBoxed).map((b) => [b.id, { x: b.x + b.width / 2, y: b.y + b.height / 2 }]),
  );
  const cross = graph.edges
    .filter(
      (e) =>
        e.from !== e.to &&
        !treeEdges.has(`${e.from}->${e.to}`) &&
        centers.has(e.from) &&
        centers.has(e.to),
    )
    .map((e) => ({
      ...reanchorArrow(edgeToArrow({ ...e, line: 'dashed' }, makeEdgeId()), centers),
      arrowStyle: 'curved' as const,
    }));
  return [...renamed, ...cross];
}
