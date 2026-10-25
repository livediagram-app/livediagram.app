// Which MCP tool is running, for the Error·Api telemetry label (docs/specs/017-telemetry/telemetry.md 'Error'):
// @liveworkspace/mcp-kit's scope, labelled with this product's tool names in PascalCase.
import { pascalToken } from '@liveplanner/api-schema';
import { runInTool as runLabelled } from '@liveworkspace/mcp-kit/tool-scope';

export { currentTool } from '@liveworkspace/mcp-kit/tool-scope';

/** Run a tool handler with its telemetry label ('update_project' -> 'UpdateProject'). */
export function runInTool<T>(toolName: string, fn: () => T): T {
  return runLabelled(pascalToken(toolName), fn);
}
