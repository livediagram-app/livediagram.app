// Which MCP tool is running (docs/specs/017-telemetry/telemetry.md 'Error', docs/specs/015-api/mcp-server.md §4.12). An api failure
// deep inside a tool (apiJson, a team-library sweep, an image fetch) reports
// `Error·Api·Http503.UpdateDiagram` rather than a bare `Http503`, so the
// Exceptions dashboard says which tool broke. Carried in AsyncLocalStorage
// (nodejs_compat) rather than threaded through every api helper, because the
// helpers sit several calls below the handler and concurrent tool calls share
// one isolate: a module-level "current tool" would mislabel them.
import { AsyncLocalStorage } from 'node:async_hooks';
import { pascalToken } from '@livediagram/api-schema';

const scope = new AsyncLocalStorage<string>();

/** Run a tool handler with its telemetry label ('update_diagram' -> 'UpdateDiagram'). */
export function runInTool<T>(toolName: string, fn: () => T): T {
  return scope.run(pascalToken(toolName), fn);
}

/** The running tool's label, or null outside a tool call. */
export function currentTool(): string | null {
  return scope.getStore() ?? null;
}
