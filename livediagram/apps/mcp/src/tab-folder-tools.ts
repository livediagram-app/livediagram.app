// Tab folders for the MCP (docs/specs/006-document/tab-folders.md "Agents", docs/specs/015-api/mcp-server.md "Tab
// folders"): change_tabs, and add_tab's `folder`, over the api's tab-order write as the caller (the shared run,
// @liveworkspace/agent-verbs/tab-folders). A refusal (an unknown tab or folder, a Viewer's grant) answers in words.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';
import {
  changeTabs,
  fileTabIn,
  mcpChangeTabs,
  tabFolderStopText,
} from '@livediagram/agent-verbs/mcp';
import { clientFor } from './api';
import { registerTool } from './tool-annotations';
import { deepLink, errorResult, requireToken, textResult } from './tool-helpers';

export function registerTabFolderTools(server: McpServer, env: Env): void {
  registerTool(server, env, mcpChangeTabs, async (args, extra) => {
    const api = clientFor(env, requireToken(extra));
    try {
      const { applied, tabs } = await changeTabs(api, args.documentId, args.changes);
      return textResult({ applied, tabs, url: deepLink(env, args.documentId) });
    } catch (err) {
      const stop = tabFolderStopText(err);
      if (stop === undefined) throw err;
      return errorResult(stop);
    }
  });
}

// add_tab's `folder`: the new tab filed once it is made. The tab is kept when it can't be filed, and the words say why.
export async function fileAddedTab(
  env: Env,
  token: string,
  id: string,
  tabId: string,
  folder: string | undefined,
): Promise<{ folder?: string; refused?: string }> {
  if (folder === undefined) return {};
  try {
    return { folder: await fileTabIn(clientFor(env, token), id, tabId, folder) };
  } catch (err) {
    const stop = tabFolderStopText(err);
    if (stop === undefined) throw err;
    return { refused: `The tab was made, but not put in a folder: ${stop}` };
  }
}
