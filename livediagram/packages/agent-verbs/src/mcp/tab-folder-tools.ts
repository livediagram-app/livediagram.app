// change_tabs, add_tab's `folder` and read_document's tab folders (docs/specs/015-api/mcp-server.md "Tab folders"):
// the shared tool (@liveworkspace/agent-verbs/mcp/tab-folder-tools) in livediagram's words, and the shared run its
// MCP calls (@liveworkspace/agent-verbs/tab-folders).
import { createTabFolderTools } from '@liveworkspace/agent-verbs/mcp/tab-folder-tools';
import type { ApiClient } from '@liveworkspace/api-client';
import {
  changeTabFolders,
  fileNewTab,
  type TabFolderChange,
} from '@liveworkspace/agent-verbs/tab-folders';
import { AGENT_PRODUCT } from '../agent-product';

export const {
  changeTabs: mcpChangeTabs,
  addTabFolder,
  addedTabFolder,
  listedTab,
} = createTabFolderTools(AGENT_PRODUCT, 'documentId');

// Its output by name, as the other tools' are (output-schema.ts).
export const changeTabsOutput = mcpChangeTabs.mcpShapes.output;

// The runs over this product's api, as the MCP calls them.
export const changeTabs = (api: ApiClient, id: string, changes: readonly TabFolderChange[]) =>
  changeTabFolders(api, AGENT_PRODUCT, id, changes);
export const fileTabIn = (api: ApiClient, id: string, tabId: string, folder: string) =>
  fileNewTab(api, AGENT_PRODUCT, id, tabId, folder);

export { listedTabsOf, tabFolderStopText } from '@liveworkspace/agent-verbs/tab-folders';
