// The large-system rules (docs/specs/020-import-export/infrastructure-import.md "Large systems", blueprint
// "infraGraph" steps 5 and 6): services sharing a name prefix framed together, then the cap, past which the rest fold
// into one "N more" box.

import type { GraphEdge } from '../graph-authoring';
import type { GraphInputNode } from '../graph-input';
import { slug } from './part';
import type { InfraGroup } from './types';

// How many names the "N more" box's note lists before it only counts.
const MORE_NOTE_NAMES = 200;

export const MORE_NODE_ID = 'more';

// The part of a label before its first `-`, `_` or `.`; null when it has none (or starts with one).
function prefixOf(label: string): string | null {
  for (let i = 0; i < label.length; i++) {
    const ch = label[i];
    if (ch === '-' || ch === '_' || ch === '.') return i > 0 ? label.slice(0, i) : null;
  }
  return null;
}

/** Frames of the nodes sharing a label prefix, two or more each, in first-seen order. */
export function groupByPrefix(nodes: readonly GraphInputNode[]): InfraGroup[] {
  const byPrefix = new Map<string, string[]>();
  for (const n of nodes) {
    const prefix = prefixOf(n.label ?? n.id);
    if (prefix === null) continue;
    const key = prefix.toLowerCase();
    const members = byPrefix.get(key);
    if (members) members.push(n.id);
    else byPrefix.set(key, [n.id]);
  }
  return [...byPrefix]
    .filter(([, members]) => members.length >= 2)
    .map(([prefix, members]) => ({ id: `grp-${slug(prefix)}`, label: prefix, members }));
}

/**
 * The first `max - 1` nodes and one "N more" box whose note lists the rest; edges and group members naming a node
 * left out are dropped. Unchanged when the nodes fit.
 */
export function capNodes(
  nodes: readonly GraphInputNode[],
  edges: readonly GraphEdge[],
  groups: readonly InfraGroup[],
  max: number,
): { nodes: GraphInputNode[]; edges: GraphEdge[]; groups: InfraGroup[]; leftOut: number } {
  if (nodes.length <= max)
    return { nodes: [...nodes], edges: [...edges], groups: [...groups], leftOut: 0 };
  const kept = nodes.slice(0, max - 1);
  const rest = nodes.slice(max - 1);
  const names = rest.slice(0, MORE_NOTE_NAMES).map((n) => n.label ?? n.id);
  const more: GraphInputNode = {
    id: MORE_NODE_ID,
    label: `${rest.length} more`,
    note:
      names.join('\n') +
      (rest.length > MORE_NOTE_NAMES ? `\nand ${rest.length - MORE_NOTE_NAMES} more` : ''),
  };
  const ids = new Set(kept.map((n) => n.id));
  return {
    nodes: [...kept, more],
    edges: edges.filter((e) => ids.has(e.from) && ids.has(e.to)),
    groups: groups
      .map((g) => ({ ...g, members: g.members.filter((m) => ids.has(m)) }))
      .filter((g) => g.members.length > 0),
    leftOut: rest.length,
  };
}
