// view_tab and view_live (docs/specs/015-api/mcp-server.md "Interactive view (MCP Apps)", "Live updates"): the
// interactive view's own tools, the shared ones (@liveworkspace/agent-verbs/mcp/view-tool) in this product's words.
// The view in the chat host calls view_tab through the host to draw a tab and to switch tabs, and view_live for the
// short-lived, view-only ticket it follows the document's room with; a host with MCP Apps keeps both from the model,
// which reads with read_document.
import { createViewTools } from '@liveworkspace/agent-verbs/mcp/view-tool';
import { AGENT_PRODUCT } from '../agent-product';

export const { viewTab: mcpViewTab, viewLive: mcpViewLive } = createViewTools(
  AGENT_PRODUCT,
  'documentId',
);

// Their outputs by name, as the other tools' are (output-schema.ts).
export const viewTabOutput = mcpViewTab.mcpShapes.output;
export const viewLiveOutput = mcpViewLive.mcpShapes.output;
