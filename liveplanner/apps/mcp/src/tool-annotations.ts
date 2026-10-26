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
import type { McpServer, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ZodRawShapeCompat } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { ZodRawShape } from 'zod';
import type { McpToolVerb } from '@liveplanner/agent-verbs/mcp';
import { pascalToken } from '@liveplanner/api-schema';
import { apiRefusalOf } from '@liveplanner/agent-verbs';
import { answerFixable, isErrorResult, TOOL_ANNOTATIONS } from '@liveworkspace/mcp-kit/tool-result';
import { postTelemetry } from './api';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { runInTool } from './tool-scope';

// Three behaviours cover every tool (a verb's `behaviour`). The split mirrors docs/specs/015-api/mcp-server.md §4.11's
// read-only-token boundary: what a `read_only = 1` token can still reach is
// exactly what `read` annotates, so the hint a client sees and the rule the
// api enforces can't drift apart.
export type ToolBehaviour = McpToolVerb['behaviour'];

// The hints each behaviour ships (`@liveworkspace/mcp-kit/tool-result`).
export { TOOL_ANNOTATIONS };

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
      const result = await answered(() => (handler as (...a: unknown[]) => unknown)(...args));
      // `Mcp·Used·<Tool>` counts calls that SUCCEEDED (docs/specs/017-telemetry/telemetry.md's success-path
      // rule): a thrown error (no token, api down) or an `isError` result
      // (bad input the model has to correct) isn't a use. A 5xx underneath is
      // still visible, as its own `Error·Api` report.
      if (!isErrorResult(result)) postTelemetry(env, 'Mcp', 'Used', pascalToken(name));
      return result;
    })) as unknown as ToolCallback<InputArgs>;
  server.registerTool(name, { ...config, annotations: TOOL_ANNOTATIONS[behaviour] }, scoped);
}

// A fixable mistake answers as a tool error in words; anything else throws (`@liveworkspace/mcp-kit/tool-result`).
const answered = (run: () => unknown) => answerFixable(run, apiRefusalOf);
