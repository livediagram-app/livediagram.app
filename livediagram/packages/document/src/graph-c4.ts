// Graph input's c4 style (docs/specs/015-api/mcp-server.md §4.7 `c4`): a level of the C4 model (System Context,
// Container or Component) drawn from a plain graph as the C4 templates draw one. It is the flow layout with three
// things of its own:
//
//  - Every node is a C4 element by its `c4Kind` (c4-look.ts): a card in its kind's colours with its name, its
//    technology or type as the meta line and its description as the body, or a database's cylinder. Each keeps the
//    size its description needs through the layout.
//  - Every group is a boundary in the C4 style, its name in the bottom-left corner, the heading band laid at the
//    frame's foot (auto-layout-clusters.ts `footHeadings`) so the name never sits on a member.
//  - A key names each kind the drawing uses beside a swatch of its fill.

import { unionRects } from '@liveworkspace/model-core/geometry-primitives';
import { C4_KINDS, C4_LOOK, C4_NODE, isC4Kind, type C4Kind, type C4NodeSpec } from './c4-look';
import { GRAPH_MUTED, withHeaderAndKey } from './graph-header';
import { createShape } from './shape-factory';
import { isBoxed, type Element } from './index';
import type { GraphInput, GraphInputNode } from './graph-input';

// A description is a sentence on the card, cut at this many characters (its whole text kept in the note).
export const C4_DESCRIPTION_MAX = 120;

// The key, the graph key's geometry (graph-header.ts): a frame right of the drawing, a row per kind.
const KEY_W = 250;
const KEY_GAP = 72;
const KEY_PAD = 20;
const KEY_ROW_H = 52;
const KEY_SWATCH_W = 44;

// What the c4 style does with a node: the kind it names, else one read from its shape and place.
function kindOf(n: GraphInputNode, grouped: boolean): C4Kind {
  const asked = (n as { c4Kind?: unknown }).c4Kind;
  if (isC4Kind(asked)) return asked;
  if (n.shape === 'actor') return 'person';
  if (n.shape === 'cylinder') return 'database';
  return grouped ? 'container' : 'system';
}

// The fields only this style reads, off an untrusted node.
const textOf = (n: GraphInputNode, key: 'tech' | 'description'): string => {
  const v = (n as Record<string, unknown>)[key];
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
};

type Flow = (
  input: GraphInput,
  options: { makeEdgeId?: () => string; footHeadings?: boolean },
) => Element[];
type Cap = (text: string, max: number) => { label: string; cut: boolean };

/** A C4 level laid out: `flow` is graph-input's own layout (passed in, so the two modules need not import each other at
 *  load), `cap` its label cap. */
export function layoutC4Graph(
  input: GraphInput,
  options: { makeEdgeId?: () => string },
  flow: Flow,
  cap: Cap,
): Element[] {
  const grouped = new Set([
    ...(input.groups ?? []).flatMap((g) => g.members ?? []),
    ...input.nodes.flatMap((n) => (n.group ? [n.id] : [])),
  ]);
  const kinds = new Map<string, C4Kind>();
  const nodes = input.nodes.map((n): GraphInputNode => {
    const kind = kindOf(n, grouped.has(n.id));
    kinds.set(n.id, kind);
    const described = textOf(n, 'description');
    const { label: body, cut } = described
      ? cap(described, C4_DESCRIPTION_MAX)
      : { label: '', cut: false };
    const spec: C4NodeSpec = {
      kind,
      meta: textOf(n, 'tech') || (kind === 'database' ? '' : C4_LOOK[kind].name),
      body: kind === 'database' ? '' : body,
      ...(n.icon ? { icon: n.icon } : {}),
    };
    // A database draws no body, so its description is its note; a cut one keeps its whole text there too.
    const note =
      (kind === 'database' && described) || cut
        ? [described, n.note].filter(Boolean).join('\n\n')
        : n.note;
    const { tone: _tone, role: _role, ...rest } = n;
    return {
      ...rest,
      shape: kind === 'database' ? 'cylinder' : 'card',
      ...(note ? { note } : {}),
      [C4_NODE]: spec,
    } as GraphInputNode;
  });
  const laid = flow(
    {
      nodes,
      edges: input.edges,
      ...(input.groups ? { groups: input.groups } : {}),
      direction: input.direction ?? 'down',
      style: 'flow',
      ...(input.lines ? { lines: input.lines } : {}),
    },
    { ...options, footHeadings: true },
  );
  // A group holding a component is a container opened up; any other a software system.
  const groupIds = new Set([
    ...(input.groups ?? []).map((g) => g.id),
    ...input.nodes.flatMap((n) => (n.group ? [n.group] : [])),
  ]);
  const metaOf = (groupId: string) => {
    const members = new Set([
      ...((input.groups ?? []).find((g) => g.id === groupId)?.members ?? []),
      ...input.nodes.filter((n) => n.group === groupId).map((n) => n.id),
    ]);
    return [...members].some((m) => kinds.get(m) === 'component')
      ? C4_LOOK.container.name
      : C4_LOOK.system.name;
  };
  // The nodes carry no tone (stripped above), so no theme preset paints over a C4 colour.
  const dressed = laid.map((el): Element =>
    el.type === 'shape' && el.shape === 'frame' && groupIds.has(el.id)
      ? c4Boundary(el, metaOf(el.id))
      : el,
  );
  const used = C4_KINDS.filter((k) => [...kinds.values()].includes(k));
  const keyed =
    input.key === false ? dressed : [...dressed, ...c4Key(dressed, used, input.key, options)];
  return withHeaderAndKey(keyed, {
    ...(input.title ? { title: input.title } : {}),
    ...(input.subtitle ? { subtitle: input.subtitle } : {}),
    ...(options.makeEdgeId ? { makeId: options.makeEdgeId } : {}),
  });
}

// A group's frame as a C4 boundary: the same box and id, its name bold in the bottom-left corner over its type.
function c4Boundary(frame: Extract<Element, { type: 'shape' }>, meta: string): Element {
  return {
    ...createShape('boundary', frame.x, frame.y),
    id: frame.id,
    width: frame.width,
    height: frame.height,
    label: frame.label ?? '',
    pageSubtitle: meta,
    boundaryStyle: 'c4',
    strokeStyle: 'long-dash',
    strokeColor: C4_LOOK.system.fill,
    textColor: C4_LOOK.system.fill,
    ...(frame.layerId ? { layerId: frame.layerId } : {}),
  };
}

let nextKeyId = 0;

// The key: a frame titled "Key" right of the drawing, one row per kind the drawing uses, each a swatch in that kind's
// colours (a cylinder for a database) beside its name. Two kinds at least, as a graph's key.
function c4Key(
  elements: Element[],
  used: readonly C4Kind[],
  names: GraphInput['key'],
  options: { makeEdgeId?: () => string },
): Element[] {
  if (used.length < 2) return [];
  const block = unionRects(elements.filter(isBoxed));
  if (!block) return [];
  const id = (base: string) =>
    options.makeEdgeId ? options.makeEdgeId() : `${base}-${(nextKeyId++).toString(36)}`;
  const given = typeof names === 'object' ? names : {};
  const x = block.x + block.width + KEY_GAP;
  const top = block.y;
  const out: Element[] = [
    {
      ...createShape('frame', x, top),
      id: id('c4-key'),
      width: KEY_W,
      height: KEY_PAD + 40 + used.length * KEY_ROW_H + KEY_PAD - 12,
      label: 'Key',
      textSize: 'md',
      textBold: true,
      textAlignX: 'left',
      textAlignY: 'top',
      padding: 'lg',
    },
  ];
  used.forEach((kind, i) => {
    const y = top + KEY_PAD + 40 + i * KEY_ROW_H;
    const hue = C4_LOOK[kind];
    out.push(
      {
        ...createShape(kind === 'database' ? 'cylinder' : 'square', x + KEY_PAD, y + 4),
        id: id(`c4-key-${kind}`),
        width: KEY_SWATCH_W,
        height: kind === 'database' ? 32 : 28,
        label: '',
        fillColor: hue.fill,
        strokeColor: hue.edge,
        themeLockFill: true,
      },
      {
        id: id(`c4-key-${kind}-label`),
        type: 'text',
        x: x + KEY_PAD + KEY_SWATCH_W + 14,
        y: y + 4,
        width: KEY_W - KEY_PAD * 2 - KEY_SWATCH_W - 14,
        height: 28,
        label: given[kind]?.trim() || hue.name,
        textSize: 'sm',
        textColor: GRAPH_MUTED,
        textAlignX: 'left',
      },
    );
  });
  return out;
}
