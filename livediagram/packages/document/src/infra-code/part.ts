// One file's drawing as it is built (blueprint "Domain and naming"): nodes by slug id, edges once each, and the tally
// of skipped keys the summary names.

import type { GraphEdge } from '../graph-authoring';
import type { GraphInputNode } from '../graph-input';
import type { InfraGroup, InfraPart, InfraSkipped } from './types';

/**
 * A resource name as an id part: lowercased, `[a-z0-9]` kept, every other run one `-`, no `-` at either end; `x`
 * when nothing is left. Character by character, so a long name costs no more than its length.
 */
export function slug(name: string): string {
  let out = '';
  let dash = false;
  for (const ch of name.toLowerCase()) {
    const keep = (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9');
    if (keep) {
      if (dash && out) out += '-';
      out += ch;
      dash = false;
    } else dash = true;
  }
  return out || 'x';
}

export const asString = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== ''
    ? v.trim()
    : typeof v === 'number'
      ? String(v)
      : undefined;

export class PartBuilder {
  private readonly nodes = new Map<string, GraphInputNode>();
  private readonly edges = new Map<string, GraphEdge>();
  private readonly groups: InfraGroup[] = [];
  private readonly skipped = new Map<string, number>();

  /** Adds a node unless one of its id is there already; returns the id. */
  node(node: GraphInputNode): string {
    if (!this.nodes.has(node.id)) this.nodes.set(node.id, node);
    return node.id;
  }

  /** Adds an edge once per pair of ends. */
  edge(edge: GraphEdge): void {
    const key = `${edge.from}>${edge.to}`;
    if (!this.edges.has(key)) this.edges.set(key, edge);
  }

  group(group: InfraGroup): void {
    this.groups.push(group);
  }

  /** Counts a key the import did not draw. */
  skip(key: string): void {
    this.skipped.set(key, (this.skipped.get(key) ?? 0) + 1);
  }

  /** An id no node has yet: `base`, else `base-2`, `base-3`, ... (two names slugging alike stay two boxes). */
  freeId(base: string): string {
    if (!this.nodes.has(base)) return base;
    let n = 2;
    while (this.nodes.has(`${base}-${n}`)) n++;
    return `${base}-${n}`;
  }

  get size(): number {
    return this.nodes.size;
  }

  done(title: string): InfraPart {
    const skipped: InfraSkipped[] = [...this.skipped].map(([key, count]) => ({ key, count }));
    return {
      title,
      nodes: [...this.nodes.values()],
      edges: [...this.edges.values()],
      groups: this.groups,
      skipped,
    };
  }
}
