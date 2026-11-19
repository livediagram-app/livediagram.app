// A tab's sources record (docs/specs/027-repositories/diagram-sources.md "The tab's sources"): the files a tab was
// drawn from and what each node and edge became, so a re-read can tell a person's edit from the source's. Saved with
// the tab as its theme is; a tab without one is every tab before it. The reader is defensive: a record a peer or an
// api write malformed reads as none, never as a half-record a merge would trust.

import { isRecord } from '@liveworkspace/model-core/is-record';

/** One source file: its name as given, its format, a fingerprint of its text, and the text while it fits the cap. */
export type DiagramSourceFile = { name: string; format: string; hash: string; text?: string };

/** What a node became: its element, and the values the source gave the fields a re-read may update. */
export type DiagramSourceNode = { el: string; label?: string; note?: string; iconId?: string };

export type DiagramSources = {
  // The bridge that reads the files: only the infrastructure import, for now.
  bridge: 'infra';
  files: DiagramSourceFile[];
  // The Wrangler environment the files were drawn with.
  env?: string;
  // When the files were last read (ms since the epoch).
  readAt: number;
  // By source key (the node's id): what it became.
  nodes: Record<string, DiagramSourceNode>;
  // By edge key (`from>to`, source keys): the arrow it became.
  edges: Record<string, string>;
};

const TRACKED = ['label', 'note', 'iconId'] as const;

function readFile(v: unknown): DiagramSourceFile | null {
  if (!isRecord(v)) return null;
  const { name, format, hash, text } = v;
  if (typeof name !== 'string' || typeof format !== 'string' || typeof hash !== 'string')
    return null;
  return { name, format, hash, ...(typeof text === 'string' ? { text } : {}) };
}

function readNode(v: unknown): DiagramSourceNode | null {
  if (!isRecord(v) || typeof v.el !== 'string') return null;
  const node: DiagramSourceNode = { el: v.el };
  for (const f of TRACKED) if (typeof v[f] === 'string') node[f] = v[f];
  return node;
}

/** The tab's sources record, or null when it has none or it does not read. */
export function tabSourcesOf(tab: { sources?: unknown }): DiagramSources | null {
  const s = tab.sources;
  if (!isRecord(s) || s.bridge !== 'infra' || !Array.isArray(s.files)) return null;
  if (!isRecord(s.nodes) || !isRecord(s.edges)) return null;
  const files = s.files.map(readFile);
  if (files.some((f) => f === null)) return null;
  const nodes: Record<string, DiagramSourceNode> = {};
  for (const [key, v] of Object.entries(s.nodes)) {
    const node = readNode(v);
    if (node) nodes[key] = node;
  }
  const edges: Record<string, string> = {};
  for (const [key, v] of Object.entries(s.edges)) if (typeof v === 'string') edges[key] = v;
  return {
    bridge: 'infra',
    files: files as DiagramSourceFile[],
    ...(typeof s.env === 'string' ? { env: s.env } : {}),
    readAt: typeof s.readAt === 'number' && Number.isFinite(s.readAt) ? s.readAt : 0,
    nodes,
    edges,
  };
}

/** The record with its element ids renamed (a duplicated tab's re-minted ids); an id not in `ids` is kept. */
export function remapSourceIds(
  sources: DiagramSources,
  ids: ReadonlyMap<string, string>,
): DiagramSources {
  const nodes: Record<string, DiagramSourceNode> = {};
  for (const [key, node] of Object.entries(sources.nodes))
    nodes[key] = { ...node, el: ids.get(node.el) ?? node.el };
  const edges: Record<string, string> = {};
  for (const [key, id] of Object.entries(sources.edges)) edges[key] = ids.get(id) ?? id;
  return { ...sources, nodes, edges };
}
