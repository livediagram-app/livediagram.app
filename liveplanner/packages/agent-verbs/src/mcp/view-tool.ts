// view_tab (docs/specs/015-api/mcp-server.md "Interactive view (MCP Apps)"): the interactive view's own tool, the
// shared board one (@liveworkspace/agent-verbs/mcp/view-tool) in this product's words. The view in the chat host
// calls it through the host to draw a tab's boards and to switch board tabs; a host with MCP Apps keeps it from the
// model, which reads the cards with list_items.
import { createBoardViewTool } from '@liveworkspace/agent-verbs/mcp/view-tool';
import { AGENT_PRODUCT } from '../agent-product';

export const mcpViewTab = createBoardViewTool(AGENT_PRODUCT, 'projectId');

// Its output by name, as the other tools' are (output-schema.ts).
export const viewTabOutput = mcpViewTab.mcpShapes.output;
