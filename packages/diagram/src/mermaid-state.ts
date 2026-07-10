// Mermaid state diagram -> DiagramGraph (spec/73). Import-only: states are
// stadium nodes, transitions are edges, composite states are clusters
// (frames), so the whole dialect rides the same layoutClusteredGraph path
// as flowcharts. Notes, concurrency separators and history states are
// skipped; export always emits flowchart text (the canvas keeps no
// state-diagram semantics to serialise back).

import type { GraphCluster, GraphEdge, GraphNode } from './graph-authoring';
import {
  cleanLine,
  decodeLabel,
  directionOf,
  type MermaidDirection,
  type ParseMermaidResult,
} from './mermaid-shared';

const HEADER_RE = /^stateDiagram(?:-v2)?$/i;
// `A --> B`, `[*] --> A`, `A --> [*] : label` — ids may carry hyphens.
const TRANSITION_RE = /^(\[\*\]|[A-Za-z0-9_-]+)\s*-->\s*(\[\*\]|[A-Za-z0-9_-]+)\s*(?::\s*(.+))?$/;
// `state "Long description" as s1` (optionally opening a composite `{`).
const STATE_AS_RE = /^state\s+"([^"]*)"\s+as\s+([A-Za-z0-9_-]+)\s*(\{)?$/i;
// `state s1 <<choice>>` / `<<fork>>` / `<<join>>`.
const STEREOTYPE_RE = /^state\s+([A-Za-z0-9_-]+)\s*<<(choice|fork|join)>>$/i;
// `state Composite {` — a plain composite state block.
const COMPOSITE_RE = /^state\s+([A-Za-z0-9_-]+)\s*\{$/i;
// `s1 : description text`.
const DESCRIPTION_RE = /^([A-Za-z0-9_-]+)\s*:\s*(.+)$/;

const STEREOTYPE_SHAPE: Record<string, GraphNode['shape']> = {
  choice: 'diamond',
  fork: 'square',
  join: 'square',
};

export function parseStateDiagram(rawLines: string[]): ParseMermaidResult {
  let direction: MermaidDirection = 'TB';

  const nodes = new Map<string, GraphNode>();
  // Ids only ever seen as a transition endpoint — a composite's id lands
  // here, and its auto-created node is removed at the end so the arrow
  // pins to the frame instead (same trick as flowchart subgraphs).
  const implicit = new Set<string>();
  const edges: GraphEdge[] = [];
  const clusters: GraphCluster[] = [];
  let currentCluster: GraphCluster | null = null;
  let compositeDepth = 0;
  let inNote = false;

  const touch = (id: string) => {
    if (!nodes.has(id)) {
      // States render as rounded boxes — the stadium.
      nodes.set(id, { id, label: id, shape: 'stadium' });
      implicit.add(id);
      if (currentCluster) currentCluster.members.push(id);
    }
    return nodes.get(id)!;
  };

  // Each composite gets its own [*] pair, matching Mermaid: the start dot
  // inside `state X { … }` is X's, not the diagram's.
  const pseudoId = (kind: 'start' | 'end') =>
    currentCluster ? `${currentCluster.id}.__${kind}__` : `__${kind}__`;
  const endpointId = (token: string, kind: 'start' | 'end') => {
    if (token !== '[*]') return token;
    const id = pseudoId(kind);
    if (!nodes.has(id)) {
      nodes.set(id, { id, label: '', shape: 'circle' });
      if (currentCluster) currentCluster.members.push(id);
    }
    return id;
  };

  for (const rawLine of rawLines) {
    const line = cleanLine(rawLine);
    if (!line) continue;

    // Multi-line notes: `note right of X` … `end note` (or the one-line
    // `note right of X : text`). Content-free for the graph — skipped.
    if (inNote) {
      if (/^end\s+note$/i.test(line)) inNote = false;
      continue;
    }
    if (/^note\b/i.test(line)) {
      if (!/:/.test(line)) inNote = true;
      continue;
    }

    if (HEADER_RE.test(line)) continue;
    const dir = /^direction\s+([A-Za-z]{2})$/i.exec(line);
    if (dir) {
      // Only the top-level direction drives the layout; a composite's
      // internal direction is finer-grained than our cluster layout goes.
      if (compositeDepth === 0) direction = directionOf(dir[1]);
      continue;
    }

    // Concurrency separator inside a composite — regions aren't modelled;
    // both halves lay out together in the one frame.
    if (line === '--') continue;

    const stereotype = STEREOTYPE_RE.exec(line);
    if (stereotype) {
      const n = touch(stereotype[1]!);
      n.shape = STEREOTYPE_SHAPE[stereotype[2]!.toLowerCase()] ?? 'stadium';
      implicit.delete(stereotype[1]!);
      continue;
    }

    const stateAs = STATE_AS_RE.exec(line);
    const composite = stateAs?.[3] ? null : COMPOSITE_RE.exec(line);
    if ((stateAs && stateAs[3]) || composite) {
      // Opening a composite block: only top-level composites become
      // frames; nested ones fold into their ancestor.
      compositeDepth += 1;
      if (compositeDepth === 1) {
        const id = stateAs ? stateAs[2]! : composite![1]!;
        const label = stateAs ? decodeLabel(stateAs[1]!) : id;
        const cluster: GraphCluster = { id, label, members: [] };
        clusters.push(cluster);
        currentCluster = cluster;
      }
      continue;
    }
    if (stateAs) {
      const n = touch(stateAs[2]!);
      n.label = decodeLabel(stateAs[1]!);
      implicit.delete(stateAs[2]!);
      continue;
    }
    if (line === '}') {
      compositeDepth = Math.max(0, compositeDepth - 1);
      if (compositeDepth === 0) currentCluster = null;
      continue;
    }

    const transition = TRANSITION_RE.exec(line);
    if (transition) {
      const from = endpointId(transition[1]!, 'start');
      const to = endpointId(transition[2]!, 'end');
      if (transition[1] !== '[*]') touch(from);
      if (transition[2] !== '[*]') touch(to);
      const label = transition[3] ? decodeLabel(transition[3]) : undefined;
      edges.push({ from, to, ...(label ? { label } : {}) });
      continue;
    }

    const description = DESCRIPTION_RE.exec(line);
    if (description) {
      const n = touch(description[1]!);
      n.label = decodeLabel(description[2]!);
      implicit.delete(description[1]!);
      continue;
    }

    // `state X` / a bare state id on its own line declares the state.
    const bare = /^(?:state\s+)?([A-Za-z0-9_-]+)$/i.exec(line);
    if (bare) {
      touch(bare[1]!);
      implicit.delete(bare[1]!);
      continue;
    }
    // Anything else (history states, unknown decoration) is skipped.
  }

  // A transition may reference a composite's id — the arrow pins to the
  // frame, so drop the auto-created node (unless a real state claimed it).
  // Only for clusters that actually BECOME frames: an empty composite
  // (`state X { }`) is dropped from the cluster list below, so deleting
  // its node too would silently erase every transition touching X. Its
  // auto node stays and the arrows keep a target.
  const surviving = new Set(clusters.filter((c) => c.members.length > 0).map((c) => c.id));
  for (const c of clusters) {
    if (surviving.has(c.id) && implicit.has(c.id) && nodes.has(c.id)) {
      nodes.delete(c.id);
      for (const other of clusters) {
        other.members = other.members.filter((m) => m !== c.id);
      }
    }
  }
  const realClusters = clusters.filter((c) => c.members.length > 0);

  if (nodes.size === 0) {
    return { ok: false, error: 'No states found in the state diagram.' };
  }
  return {
    ok: true,
    graph: {
      nodes: [...nodes.values()],
      edges,
      ...(realClusters.length ? { clusters: realClusters } : {}),
    },
    direction,
  };
}
