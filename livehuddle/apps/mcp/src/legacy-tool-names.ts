// Tool names before the container became a document (docs/specs/015-api/mcp-server.md,
// "Deprecated tool names"): each `*_document(s)` tool is also served under its old
// `*_diagram(s)` name, announced as deprecated, until the sunset.
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { McpServer, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import {
  getParseErrorMessage,
  safeParseAsync,
  type ZodRawShapeCompat,
} from '@modelcontextprotocol/sdk/server/zod-compat.js';
import { z } from 'zod';

export const LEGACY_TOOL_SUNSET = '2027-04-30';

export function legacyToolName(name: string): string | null {
  return /_documents?$/.test(name) ? name.replace(/_document(s?)$/, '_diagram$1') : null;
}

export function successorToolName(name: string): string {
  return name.replace(/_diagram(s?)$/, '_document$1');
}

export function isDeprecatedDescription(description: string | undefined): boolean {
  return (description ?? '').startsWith('Deprecated');
}

export function deprecatedDescription(successor: string): string {
  return `Deprecated: use ${successor} instead; this name is removed on ${LEGACY_TOOL_SUNSET}. It takes the same input as ${successor}.`;
}

// What an alias lists as its input: any object. The successor's schema is the one that checks it, below, so the
// tool list carries each schema once (create_document's and update_document's element format is most of the list).
export const LEGACY_INPUT_SHAPE = z.looseObject({});

/**
 * Register `successor`'s old name: the same handler, annotations and output schema, a one-line description and an
 * open input schema, the arguments checked against the successor's schema exactly as the SDK checks a tool's own.
 */
export function registerLegacyAlias(
  server: McpServer,
  successor: {
    name: string;
    title: string;
    inputSchema: z.ZodRawShape;
    outputSchema?: ZodRawShapeCompat;
  },
  annotations: ToolAnnotations,
  handler: ToolCallback<ZodRawShapeCompat>,
): void {
  const legacy = legacyToolName(successor.name);
  if (!legacy) return;
  const schema = z.object(successor.inputSchema);
  const aliased = async (args: unknown, extra: unknown): Promise<unknown> => {
    console.warn('[mcp] deprecated tool name', legacy, '->', successor.name);
    const parsed = await safeParseAsync(schema, args);
    if (!parsed.success)
      throw new McpError(
        ErrorCode.InvalidParams,
        `Input validation error: Invalid arguments for tool ${legacy}: ${getParseErrorMessage(parsed.error)}`,
      );
    return (handler as (...a: unknown[]) => unknown)(parsed.data, extra);
  };
  server.registerTool(
    legacy,
    {
      title: `${successor.title} (deprecated)`,
      description: deprecatedDescription(successor.name),
      inputSchema: LEGACY_INPUT_SHAPE,
      outputSchema: successor.outputSchema,
      annotations,
    },
    aliased as unknown as ToolCallback<typeof LEGACY_INPUT_SHAPE>,
  );
}
