// The comment thread tools (docs/specs/015-api/mcp-server.md "Comment threads"): list_threads reads a document's threads
// and change_threads works them by element ref, over the api's comment endpoints, as its person (the shared run,
// @liveworkspace/agent-verbs/mcp/thread-run). A refusal answers in words, naming what was applied before it.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { apiRefusalOf } from '@livediagram/agent-verbs';
import {
  applyThreadChanges,
  listThreads,
  mcpChangeThreads,
  mcpListThreads,
  threadStopText,
} from '@livediagram/agent-verbs/mcp';
import { clientFor } from './api';
import { registerTool } from './tool-annotations';
import { deepLink, errorResult, requireToken, textResult } from './tool-helpers';

export function registerThreadTools(server: McpServer, env: Env): void {
  registerTool(server, env, mcpListThreads, async (args, extra) => {
    const api = clientFor(env, requireToken(extra));
    const threads = await listThreads(api, args.documentId, args.status ?? 'open', args.tabId);
    return textResult({ threads, count: threads.length, url: deepLink(env, args.documentId) });
  });

  registerTool(server, env, mcpChangeThreads, async (args, extra) => {
    const api = clientFor(env, requireToken(extra));
    const { applied, refusal } = await applyThreadChanges(
      api,
      args.documentId,
      args.changes,
      apiRefusalOf,
    );
    if (refusal) return errorResult(threadStopText(applied, refusal));
    return textResult({ applied, url: deepLink(env, args.documentId) });
  });
}
