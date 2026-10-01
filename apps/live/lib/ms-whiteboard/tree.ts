// The board tree (docs/specs/020-import-export/whiteboard-import.md "The format"): nodes with a
// type, an optional payload and id, and named traits of ordered children.
import { base64ToBytes } from './values';

export type WbNode = {
  id?: string;
  type: string;
  payload?: Uint8Array;
  traits: Map<string, WbNode[]>;
  /** Build order across the replay: a single-valued trait reads its highest. */
  seq: number;
};

/** The id index plus the build counter, shared by one replay. */
export type TreeIndex = { nodes: Map<string, WbNode>; seq: number };

export const createIndex = (): TreeIndex => ({ nodes: new Map(), seq: 0 });

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** A node from its JSON shape, indexed; null when the shape is not a node. */
export function buildNode(raw: unknown, index: TreeIndex): WbNode | null {
  if (!isRecord(raw) || typeof raw.nrefIsa !== 'string') return null;
  const node: WbNode = { type: raw.nrefIsa, traits: new Map(), seq: ++index.seq };
  if (typeof raw.fuid === 'string') node.id = raw.fuid;
  if (typeof raw.payload === 'string') {
    const bytes = base64ToBytes(raw.payload);
    if (bytes) node.payload = bytes;
  }
  if (Array.isArray(raw.traits)) {
    for (const t of raw.traits) {
      if (!isRecord(t) || typeof t.trait !== 'string' || !Array.isArray(t.children)) continue;
      const children: WbNode[] = [];
      for (const c of t.children) {
        const child = buildNode(c, index);
        if (child) children.push(child);
      }
      node.traits.set(t.trait, children);
    }
  }
  if (node.id) index.nodes.set(node.id, node);
  return node;
}

/** Drops a removed node and everything under it from the index. */
export function unindex(node: WbNode, index: TreeIndex): void {
  if (node.id && index.nodes.get(node.id) === node) index.nodes.delete(node.id);
  for (const children of node.traits.values()) for (const c of children) unindex(c, index);
}

/** A trait's children (empty when absent). */
export const children = (node: WbNode, trait: string): WbNode[] => node.traits.get(trait) ?? [];

/** A single-valued trait's value: its most recently built child. */
export function single(node: WbNode, trait: string): WbNode | undefined {
  let best: WbNode | undefined;
  for (const c of children(node, trait)) if (!best || c.seq > best.seq) best = c;
  return best;
}
