// An ambient module declaration has nothing to import; the reference makes every Worker compiling this module see it.
// oxlint-disable-next-line typescript/triple-slash-reference
/// <reference path="./async-hooks.d.ts" />
// Which MCP tool is running (each product's docs/specs/017-telemetry/telemetry.md 'Error' and
// docs/specs/015-api/mcp-server.md §4.12). An api failure deep inside a tool (an api call, a team-library sweep,
// an image fetch) reports `Error·Api·Http503.UpdateDocument` rather than a bare `Http503`, so the Exceptions
// dashboard says which tool broke. Carried in AsyncLocalStorage (nodejs_compat) rather than threaded through every
// api helper, because the helpers sit several calls below the handler and concurrent tool calls share one
// isolate: a module-level "current tool" would mislabel them.
import { AsyncLocalStorage } from 'node:async_hooks';

const scope = new AsyncLocalStorage<string>();

/** Run a tool handler under its telemetry label (`UpdateDocument`; the product spells it from the tool name). */
export function runInTool<T>(label: string, fn: () => T): T {
  return scope.run(label, fn);
}

/** The running tool's label, or null outside a tool call. */
export function currentTool(): string | null {
  return scope.getStore() ?? null;
}
