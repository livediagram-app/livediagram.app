// MCP tool annotations (docs/specs/015-api/mcp-server.md §4.14): the behaviour hints every tool ships
// beside its title and description, plus the `registerTool` wrapper that makes
// declaring one unavoidable. The same wrapper is the one place a tool reports
// its `Mcp·Used` telemetry (docs/specs/017-telemetry/telemetry.md), so no tool can forget to, and each
// reports only a call that succeeded.
//
// A client reads these hints to decide whether a call needs a per-use
// permission prompt (read-only tools run without interrupting the user,
// destructive ones always ask), and connector directories require them, so a
// tool with no annotations is a listing blocker as well as a worse experience.
// Nothing at runtime notices when a hint is missing (the tool still works, it
// just prompts wrongly), which is why the wrapper types `behaviour` as
// required rather than trusting each registration to remember.
import { deprecatedDescription, legacyToolName } from './legacy-tool-names';
import type { McpServer, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ZodRawShapeCompat } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { ZodRawShape } from 'zod';
import type { McpToolVerb } from '@livediagram/agent-verbs/mcp';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { pascalToken } from '@livediagram/api-schema';
import { postTelemetry } from './api';
import type { Env } from './env';
import { runInTool } from './tool-scope';

// Three behaviours cover every tool (a verb's `behaviour`). The split mirrors docs/specs/015-api/mcp-server.md §4.11's
// read-only-token boundary: what a `read_only = 1` token can still reach is
// exactly what `read` annotates, so the hint a client sees and the rule the
// api enforces can't drift apart.
export type ToolBehaviour = McpToolVerb['behaviour'];

// `openWorldHint: false` throughout: every tool acts on the caller's own
// livediagram library through our api, a closed and known domain rather than
// an open-ended external world like a web search.
//
// `destructiveHint` is omitted on `read` on purpose. MCP ignores it when
// `readOnlyHint` is true, and stating it would imply the tool writes at all.
export const TOOL_ANNOTATIONS: Record<ToolBehaviour, ToolAnnotations> = {
  read: { readOnlyHint: true, openWorldHint: false },
  // Additive: creates a document, a tab, a link. Nothing that existed is lost.
  write: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  // May overwrite or remove what the user already had, so a client should ask
  // before each call.
  destructive: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
};

/**
 * Register an MCP tool with its behaviour annotations attached.
 *
 * Use this instead of `server.registerTool` for every tool (docs/specs/015-api/mcp-server.md §4.14).
 * It is the same call with `behaviour` in place of a hand-written
 * `annotations` block, so the hints stay consistent across the surface.
 */
export function registerTool<
  InputArgs extends ZodRawShapeCompat & ZodRawShape,
  OutputArgs extends ZodRawShape,
>(
  server: McpServer,
  env: Env,
  verb: McpToolVerb<InputArgs, OutputArgs>,
  handler: ToolCallback<InputArgs>,
): void {
  // The tool as its verb declares it (packages/agent-verbs mcp-tools.ts): name, words, behaviour and schemas.
  const name = verb.mcp.tool;
  const behaviour = verb.behaviour;
  const config = {
    title: verb.mcp.title,
    description: verb.description,
    inputSchema: verb.mcpShapes.input,
    outputSchema: verb.mcpShapes.output,
  };
  // The handler runs inside the tool's scope so an api failure anywhere below
  // it reports which tool it came from (tool-scope.ts).
  const scoped = ((...args: unknown[]) =>
    runInTool(name, async () => {
      const result = await (handler as (...a: unknown[]) => unknown)(...args);
      // `Mcp·Used·<Tool>` counts calls that SUCCEEDED (docs/specs/017-telemetry/telemetry.md's success-path
      // rule): a thrown error (no token, api down) or an `isError` result
      // (bad input the model has to correct) isn't a use. A 5xx underneath is
      // still visible, as its own `Error·Api` report.
      if (!isErrorResult(result)) postTelemetry(env, 'Mcp', 'Used', pascalToken(name));
      return result;
    })) as unknown as ToolCallback<InputArgs>;
  server.registerTool(name, { ...config, annotations: TOOL_ANNOTATIONS[behaviour] }, scoped);
  const legacy = legacyToolName(name);
  if (legacy) {
    // The tool's name before the container became a document (docs/specs/015-api/mcp-server.md,
    // "Deprecated tool names"): the same tool, announced as deprecated, until the sunset.
    const aliased = ((...args: unknown[]) => {
      console.warn('[mcp] deprecated tool name', legacy, '->', name);
      return (scoped as (...a: unknown[]) => unknown)(...args);
    }) as unknown as ToolCallback<InputArgs>;
    server.registerTool(
      legacy,
      {
        ...config,
        title: `${config.title} (deprecated)`,
        description: deprecatedDescription(name, config.description),
        annotations: TOOL_ANNOTATIONS[behaviour],
      },
      aliased,
    );
  }
}

function isErrorResult(result: unknown): boolean {
  return (
    typeof result === 'object' &&
    result !== null &&
    (result as { isError?: unknown }).isError === true
  );
}
