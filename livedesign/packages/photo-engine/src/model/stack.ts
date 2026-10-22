// The layer stack as a tree (docs/specs/031-photo/blueprints/photo-engine.md "The model"): stack
// order is array order, bottom first, and a group's children sit contiguously directly below the
// group's own entry, so one bottom-to-top pass with a group stack composites the tree.
import { PHOTO_MAX_GROUP_DEPTH } from './limits';
import type { PhotoLayer } from './types';

type Node = { layer: PhotoLayer; children: Node[] };

/** The layers in the stack's invariant order: each layer under its group (a `parent` naming no
 *  group, making a cycle, or nesting past five deep is cleared), siblings in their relative order, a
 *  group's place among its siblings its own entry's. Same array back when nothing moved. */
export function normaliseStack(layers: readonly PhotoLayer[]): PhotoLayer[] {
  const byId = new Map(layers.map((l) => [l.id, l]));
  const parentOf = (l: PhotoLayer): string | undefined => {
    if (!l.parent) return undefined;
    const p = byId.get(l.parent);
    return p && p.layerKind === 'group' ? p.id : undefined;
  };
  // Clear cycles and too-deep nesting: walk up from each layer.
  const cleared = new Set<string>();
  for (const l of layers) {
    const seen = new Set<string>([l.id]);
    let depth = 0;
    let at = parentOf(l);
    while (at) {
      depth += 1;
      if (seen.has(at) || depth > PHOTO_MAX_GROUP_DEPTH) {
        cleared.add(l.id);
        break;
      }
      seen.add(at);
      at = parentOf(byId.get(at)!);
    }
  }
  const effectiveParent = (l: PhotoLayer) => (cleared.has(l.id) ? undefined : parentOf(l));
  const nodes = new Map<string, Node>(layers.map((l) => [l.id, { layer: l, children: [] }]));
  const roots: Node[] = [];
  for (const l of layers) {
    const p = effectiveParent(l);
    const node = nodes.get(l.id)!;
    if (p) nodes.get(p)!.children.push(node);
    else roots.push(node);
  }
  const out: PhotoLayer[] = [];
  const emit = (node: Node) => {
    for (const child of node.children) emit(child);
    const l = node.layer;
    if (l.parent && !effectiveParent(l)) {
      const { parent: _drop, ...rest } = l;
      void _drop;
      out.push(rest);
    } else out.push(l);
  };
  for (const r of roots) emit(r);
  return out.length === layers.length && out.every((l, i) => l === layers[i])
    ? (layers as PhotoLayer[])
    : out;
}

/** The ids of a group's layers, all the way down, bottom first. */
export function descendantIds(layers: readonly PhotoLayer[], groupId: string): string[] {
  const inside = new Set([groupId]);
  const out: string[] = [];
  // Children sit below their group, so walking down from the group finds them all; a parent is
  // always above its children, so walking top-down collects nested ones too.
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i]!;
    if (l.parent && inside.has(l.parent)) {
      inside.add(l.id);
      out.push(l.id);
    }
  }
  return out.reverse();
}

/** The layer's group, its group's group, and so on, nearest first. */
export function ancestorIds(layers: readonly PhotoLayer[], id: string): string[] {
  const byId = new Map(layers.map((l) => [l.id, l]));
  const out: string[] = [];
  let at = byId.get(id)?.parent;
  while (at && !out.includes(at)) {
    out.push(at);
    at = byId.get(at)?.parent;
  }
  return out;
}

/** Whether the layer shows: it and every group it is in are visible. */
export function isShown(layers: readonly PhotoLayer[], id: string): boolean {
  const byId = new Map(layers.map((l) => [l.id, l]));
  const layer = byId.get(id);
  if (!layer || layer.visible === false) return false;
  return ancestorIds(layers, id).every((g) => byId.get(g)?.visible !== false);
}

/** The layers of one container (the top level when `parent` is undefined), bottom first. */
export function siblingsOf(
  layers: readonly PhotoLayer[],
  parent: string | undefined,
): PhotoLayer[] {
  return layers.filter((l) => l.parent === parent);
}

/** The base a clipped layer clips to: the nearest unclipped sibling under it. */
export function clipBaseOf(layers: readonly PhotoLayer[], id: string): PhotoLayer | undefined {
  const at = layers.findIndex((l) => l.id === id);
  if (at < 0 || !layers[at]!.clip) return undefined;
  const parent = layers[at]!.parent;
  for (let i = at - 1; i >= 0; i--) {
    const l = layers[i]!;
    // Skip a sibling group's descendants: they sit between it and us, but are not siblings.
    if (l.parent !== parent) continue;
    if (!l.clip) return l;
  }
  return undefined;
}

/** The layer's depth: 0 at the top level. */
export function depthOf(layers: readonly PhotoLayer[], id: string): number {
  return ancestorIds(layers, id).length;
}

/** The layers top first, as the Layers tab lists them, with each one's depth; a collapsed group's
 *  descendants left out. */
export function listedLayers(
  layers: readonly PhotoLayer[],
): { layer: PhotoLayer; depth: number }[] {
  const out: { layer: PhotoLayer; depth: number }[] = [];
  const collapsed = new Set(
    layers.filter((l) => l.layerKind === 'group' && l.collapsed).map((l) => l.id),
  );
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i]!;
    const ancestors = ancestorIds(layers, l.id);
    if (ancestors.some((a) => collapsed.has(a))) continue;
    out.push({ layer: l, depth: ancestors.length });
  }
  return out;
}
