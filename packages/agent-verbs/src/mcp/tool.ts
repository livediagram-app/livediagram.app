// An MCP tool as a verb (docs/specs/015-api/cli.md "One catalogue for the CLI and the MCP", blueprint "The verb"):
// its tool name, title, description, behaviour and its input and output schemas as the MCP has always published
// them. Each product's mcp-tools.ts declares its tools with `mcpTool`; its MCP registers every tool from its verb,
// and a parity test there fails when a registered tool and its verb disagree.

import { z } from 'zod';
import type { VerbBehaviour } from '../define';

export type ToolDecl<S extends z.ZodRawShape, O extends z.ZodRawShape> = {
  behaviour: VerbBehaviour;
  title: string;
  description: string;
  inputSchema: S;
  outputSchema: O;
};

// A tool as a verb: the catalogue's id, words and behaviour, its schemas as zod objects, and the raw shapes the MCP
// SDK takes. No CLI projection: the CLI's own commands are other verbs.
export type McpToolVerb<
  S extends z.ZodRawShape = z.ZodRawShape,
  O extends z.ZodRawShape = z.ZodRawShape,
> = {
  id: string;
  summary: string;
  description: string;
  behaviour: VerbBehaviour;
  input: z.ZodObject<S>;
  output: z.ZodObject<O>;
  mcp: { tool: string; title: string };
  mcpShapes: { input: S; output: O };
};

export function mcpTool<S extends z.ZodRawShape, O extends z.ZodRawShape>(
  tool: string,
  decl: ToolDecl<S, O>,
): McpToolVerb<S, O> {
  return {
    id: `mcp.${tool}`,
    summary: decl.title,
    description: decl.description,
    behaviour: decl.behaviour,
    input: z.object(decl.inputSchema),
    output: z.object(decl.outputSchema),
    mcp: { tool, title: decl.title },
    // The shapes exactly as the MCP passes them to the SDK, which takes raw shapes.
    mcpShapes: { input: decl.inputSchema, output: decl.outputSchema },
  };
}
