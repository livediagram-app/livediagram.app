// view_tab, view_live and view_edit (docs/specs/015-api/mcp-server.md "Interactive view (MCP Apps)", "Live updates",
// "Edits in the view"): the interactive view's own tools, the shared ones (@liveworkspace/agent-verbs/mcp/view-tool)
// in this product's words. The view in the chat host calls view_tab through the host to draw a tab and to switch tabs,
// view_live for the short-lived, view-only ticket it follows the document's room with, and view_edit to save a rename
// or a move for an edit-level token; a host with MCP Apps keeps all three from the model, which reads with
// read_document and edits with update_document.
import { createViewTools } from '@liveworkspace/agent-verbs/mcp/view-tool';
import { AGENT_PRODUCT } from '../agent-product';

export const {
  viewTab: mcpViewTab,
  viewLive: mcpViewLive,
  viewEdit: mcpViewEdit,
} = createViewTools(AGENT_PRODUCT, 'documentId');

// Their outputs by name, as the other tools' are (output-schema.ts).
export const viewTabOutput = mcpViewTab.mcpShapes.output;
export const viewLiveOutput = mcpViewLive.mcpShapes.output;
export const viewEditOutput = mcpViewEdit.mcpShapes.output;
