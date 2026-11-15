// view_tab (docs/specs/015-api/mcp-server.md "Interactive view (MCP Apps)"): the interactive view's own tool, the
// shared one (@liveworkspace/agent-verbs/mcp/view-tool) in this product's words, one page at a time. The view in the
// chat host calls it through the host to draw a page and to flip pages and tabs; a host with MCP Apps keeps it from
// the model, which reads with read_document.
import { createPageViewTool } from '@liveworkspace/agent-verbs/mcp/view-tool';
import { AGENT_PRODUCT } from '../agent-product';

export const mcpViewTab = createPageViewTool(AGENT_PRODUCT, 'documentId');

// Its output by name, as the other tools' are (output-schema.ts).
export const viewTabOutput = mcpViewTab.mcpShapes.output;
