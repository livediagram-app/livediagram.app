// view_tab and view_live (docs/specs/015-api/mcp-server.md "Interactive view (MCP Apps)", "Live updates"): the
// interactive view's own tools, the shared ones (@liveworkspace/agent-verbs/mcp/view-tool) in this product's words.
// The view in the chat host calls view_tab through the host to draw a page and to flip pages and tabs, and view_live
// for the short-lived, view-only ticket it follows the design's room with; a host with MCP Apps keeps both from the
// model, which reads with read_design.
import { createPageViewTool, createViewLiveTool } from '@liveworkspace/agent-verbs/mcp/view-tool';
import { AGENT_PRODUCT } from '../agent-product';

export const mcpViewTab = createPageViewTool(AGENT_PRODUCT, 'designId');
export const mcpViewLive = createViewLiveTool(AGENT_PRODUCT, 'designId');

// Their outputs by name, as the other tools' are (output-schema.ts).
export const viewTabOutput = mcpViewTab.mcpShapes.output;
export const viewLiveOutput = mcpViewLive.mcpShapes.output;
