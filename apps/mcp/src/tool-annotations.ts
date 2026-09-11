// MCP tool annotations (spec/62 §4.14): the behaviour hints every tool ships
// beside its title and description, plus the `registerTool` wrapper that makes
// declaring one unavoidable.
//
// A client reads these hints to decide whether a call needs a per-use
// permission prompt (read-only tools run without interrupting the user,
// destructive ones always ask), and connector directories require them, so a
// tool with no annotations is a listing blocker as well as a worse experience.
// Nothing at runtime notices when a hint is missing (the tool still works, it
// just prompts wrongly), which is why the wrapper types `behaviour` as
// required rather than trusting each registration to remember.
import type { McpServer, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ZodRawShapeCompat } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

// Three behaviours cover every tool. The split mirrors spec/62 §4.11's
// read-only-token boundary: what a `read_only = 1` token can still reach is
// exactly what `read` annotates, so the hint a client sees and the rule the
// api enforces can't drift apart.
export type ToolBehaviour = 'read' | 'write' | 'destructive';

// `openWorldHint: false` throughout: every tool acts on the caller's own
// livediagram library through our api, a closed and known domain rather than
// an open-ended external world like a web search.
//
// `destructiveHint` is omitted on `read` on purpose. MCP ignores it when
// `readOnlyHint` is true, and stating it would imply the tool writes at all.
export const TOOL_ANNOTATIONS: Record<ToolBehaviour, ToolAnnotations> = {
  read: { readOnlyHint: true, openWorldHint: false },
  // Additive: creates a diagram, a tab, a link. Nothing that existed is lost.
  write: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  // May overwrite or remove what the user already had, so a client should ask
  // before each call.
  destructive: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
};

type ToolConfig<InputArgs extends ZodRawShapeCompat> = {
  title: string;
  description: string;
  // Required, and the whole point of this wrapper: a new tool cannot reach the
  // wire unannotated, because omitting this is a type error.
  behaviour: ToolBehaviour;
  inputSchema: InputArgs;
};

/**
 * Register an MCP tool with its behaviour annotations attached.
 *
 * Use this instead of `server.registerTool` for every tool (spec/62 §4.14).
 * It is the same call with `behaviour` in place of a hand-written
 * `annotations` block, so the hints stay consistent across the surface.
 */
export function registerTool<InputArgs extends ZodRawShapeCompat>(
  server: McpServer,
  name: string,
  { behaviour, ...config }: ToolConfig<InputArgs>,
  handler: ToolCallback<InputArgs>,
): void {
  server.registerTool(name, { ...config, annotations: TOOL_ANNOTATIONS[behaviour] }, handler);
}
