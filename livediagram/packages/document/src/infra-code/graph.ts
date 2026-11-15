// Infrastructure files to one graph (docs/specs/020-import-export/infrastructure-import.md, blueprint "infraGraph"):
// each file detected, parsed and drawn, the parts merged by node id, then grouped and capped so a large system still
// reads. The graph goes to the graph builder (layoutGraph, or the api's `replace.graph`) like any other.

import type { GraphEdge } from '../graph-authoring';
import type { GraphInput, GraphInputNode } from '../graph-input';
import { GRAPH_LAYOUT_MAX_EDGES } from '../graph-limits';
import { composePart } from './compose';
import { detectInfraFormat } from './detect';
import { capNodes, groupByPrefix } from './large';
import { INFRA_GROUP_FROM, INFRA_MAX_FILES, INFRA_MAX_NODES } from './limits';
import { parseInfraText } from './parse';
import { mergeSkipped } from './summary';
import type { InfraFile, InfraFormat, InfraGroup, InfraPart, InfraResult } from './types';
import { wranglerPart } from './wrangler';

// What a paste is called where a file would be named.
const PASTE_NAME: Record<InfraFormat, string> = {
  wrangler: 'wrangler.toml',
  compose: 'docker-compose.yml',
};

// The longest title and subtitle the drawing's header takes.
const TITLE_MAX = 120;

// The folder a file sits in (`apps/api/wrangler.toml` is `api`), naming a Worker that has no `name`.
function folderOf(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const parts = name.split(/[/\\]/).filter((p) => p !== '' && p !== '.');
  return parts.length >= 2 ? parts[parts.length - 2] : undefined;
}

// Several parts' titles as one: up to three named, then a count.
function titleOf(parts: readonly InfraPart[]): string {
  const titles = [...new Set(parts.map((p) => p.title))];
  const text =
    titles.length <= 3
      ? titles.join(', ')
      : `${titles.slice(0, 2).join(', ')} and ${titles.length - 2} more`;
  return text.slice(0, TITLE_MAX);
}

export function infraGraph(
  files: readonly InfraFile[],
  options: { env?: string } = {},
): InfraResult {
  if (files.length > INFRA_MAX_FILES)
    return {
      ok: false,
      error: {
        code: 'too-many-files',
        message: `Up to ${INFRA_MAX_FILES} files can be drawn at once.`,
      },
    };
  const parts: InfraPart[] = [];
  const read: { name: string; format: InfraFormat; boxes: number }[] = [];
  for (const file of files) {
    const format = detectInfraFormat(file.name, file.text);
    const parsed = parseInfraText(format, file.text);
    if (!parsed.ok)
      return { ok: false, error: { ...parsed.error, ...(file.name ? { file: file.name } : {}) } };
    const fallback = folderOf(file.name) ?? (format === 'wrangler' ? 'Worker' : 'Compose');
    const built =
      format === 'wrangler'
        ? wranglerPart(parsed.value, fallback, options.env)
        : composePart(parsed.value, fallback);
    if (!built.ok)
      return { ok: false, error: { ...built.error, ...(file.name ? { file: file.name } : {}) } };
    parts.push(built.part);
    read.push({ name: file.name ?? PASTE_NAME[format], format, boxes: built.part.nodes.length });
  }

  // Merged by id: a resource two files name is one box, its first file's label, icon and note.
  const nodes = new Map<string, GraphInputNode>();
  const edges = new Map<string, GraphEdge>();
  const groups = new Map<string, InfraGroup>();
  for (const part of parts) {
    for (const n of part.nodes) if (!nodes.has(n.id)) nodes.set(n.id, n);
    for (const e of part.edges) {
      const key = `${e.from}>${e.to}`;
      if (!edges.has(key)) edges.set(key, e);
    }
    for (const g of part.groups) {
      const was = groups.get(g.id);
      if (was) was.members.push(...g.members.filter((m) => !was.members.includes(m)));
      else groups.set(g.id, { ...g, members: [...g.members] });
    }
  }
  if (nodes.size === 0)
    return {
      ok: false,
      error: {
        code: 'nothing-to-draw',
        message:
          'Found no Worker or bindings to draw. A wrangler.toml needs a name or a binding; Compose needs services.',
      },
    };

  const all = [...nodes.values()];
  const framed =
    groups.size === 0 && all.length > INFRA_GROUP_FROM ? groupByPrefix(all) : [...groups.values()];
  const capped = capNodes(all, [...edges.values()], framed, INFRA_MAX_NODES);
  // The graph builder's line cap; past it a system this tangled no longer reads anyway.
  const lines = capped.edges.slice(0, GRAPH_LAYOUT_MAX_EDGES);
  const subtitle = `From ${read.map((r) => r.name).join(', ')}`.slice(0, TITLE_MAX);
  const graph: GraphInput = {
    title: titleOf(parts),
    subtitle,
    nodes: capped.nodes,
    edges: lines,
    ...(capped.groups.length ? { groups: capped.groups } : {}),
    style: 'flow',
  };
  return {
    ok: true,
    graph,
    files: read,
    skipped: mergeSkipped(parts.map((p) => p.skipped)),
    leftOut: capped.leftOut,
    linesLeftOut: capped.edges.length - lines.length,
  };
}
