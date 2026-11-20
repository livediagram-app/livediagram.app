// A tool's graph-shaped input as the MCP draws it: the graph or Mermaid resolved (@livediagram/document
// resolveGraphInput), then each icon that names none left off its node and said in a note, never refused
// (docs/specs/015-api/mcp-server.md §4.7 "What a graph leaves out").
import { resolveGraphInput } from '@livediagram/document';
import { withKnownIcons } from './element-values';

type GraphArgs = Parameters<typeof resolveGraphInput>[0];

export function graphInputOf(args: GraphArgs): ReturnType<typeof resolveGraphInput> {
  const input = resolveGraphInput(args);
  if (!input.graph) return input;
  const { nodes, note } = withKnownIcons(input.graph.nodes);
  if (note === null) return input;
  return { graph: { ...input.graph, nodes }, notes: [...(input.notes ?? []), note] };
}
