// Infrastructure files to one graph (docs/specs/020-import-export/infrastructure-import.md, blueprint "infraGraph"):
// each file detected, parsed and drawn, the parts merged by node id, then grouped and capped so a large system still
// reads. The graph goes to the graph builder (layoutGraph, or the api's `replace.graph`) like any other.

import type { GraphEdge } from '../graph-authoring';
import type { GraphInput, GraphInputNode } from '../graph-input';
import { GRAPH_LAYOUT_MAX_EDGES } from '../graph-limits';
import { hasEnv, partOf, readInfraFile, type ParsedFile } from './file-part';
import { capNodes, groupByPrefix } from './large';
import { INFRA_GROUP_FROM, INFRA_MAX_FILES, INFRA_MAX_NODES } from './limits';
import { PASTE_NAME } from './paste-name';
import { mergeSkipped } from './summary';
import type { InfraFile, InfraFormat, InfraGroup, InfraPart, InfraResult } from './types';

// The longest title and subtitle the drawing's header takes.
const TITLE_MAX = 120;

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
  const parsedFiles: ParsedFile[] = [];
  for (const file of files) {
    const read = readInfraFile(file);
    if (!read.ok) return read;
    parsedFiles.push(read.parsed);
  }
  const { env } = options;
  // The environment drawn by every wrangler.toml that has it; when none has it, the first one's error says which
  // environments there are.
  const anyHasEnv = env !== undefined && parsedFiles.some((p) => hasEnv(p, env));
  const parts: InfraPart[] = [];
  const read: { name: string; format: InfraFormat; boxes: number }[] = [];
  for (const [i, parsed] of parsedFiles.entries()) {
    const file = files[i]!;
    const own = env !== undefined && (hasEnv(parsed, env) || !anyHasEnv) ? env : undefined;
    const built = partOf(parsed, file, own);
    if (!built.ok) return built;
    const part = built.part;
    if (env !== undefined && own === undefined && parsed.format === 'wrangler')
      part.skipped.push({ key: `env.${env} not in ${part.title}`, count: 1 });
    parts.push(part);
    read.push({
      name: file.name ?? PASTE_NAME[parsed.format],
      format: parsed.format,
      boxes: part.nodes.length,
    });
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
