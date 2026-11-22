// Approval and the comments at a page's foot (docs/specs/030-knowledgebase/approval.md, page-comments.md "Agents"):
// request_approval, list_page_comments and change_page_comments, each over the api as its person, through the
// shared run the CLI's commands use (@liveknowledge/agent-verbs page-feedback). The api holds the rules; a refusal
// answers in its words, naming what was applied before it.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';
import {
  apiRefusalOf,
  applyPageCommentChanges,
  listPageComments,
  requestApproval,
} from '@liveknowledge/agent-verbs';
import {
  mcpChangePageComments,
  mcpListPageComments,
  mcpRequestApproval,
} from '@liveknowledge/agent-verbs/mcp';
import { knowledgeApi } from './knowledge-client';
import { registerTool } from './tool-annotations';
import { deepLink, errorResult, textResult } from './tool-helpers';

export function registerPageFeedbackTools(server: McpServer, env: Env): void {
  registerTool(server, env, mcpRequestApproval, async (args, extra) => {
    const api = await knowledgeApi(server, env, extra);
    const answer = await requestApproval(api, args.documentId, args.page, args.withdraw === true);
    return textResult({
      ...answer,
      url: deepLink(env, args.documentId),
      next:
        answer.approval === 'pending'
          ? 'A person approves or rejects it; tell the user it waits for someone on the team. read_page shows approval and, once rejected, approval_note.'
          : 'The request is gone. request_approval asks again.',
    });
  });

  registerTool(server, env, mcpListPageComments, async (args, extra) => {
    const api = await knowledgeApi(server, env, extra);
    const listed = await listPageComments(api, args.documentId, args.page, args.status ?? 'open');
    return textResult({
      ...listed,
      count: listed.threads.length,
      url: deepLink(env, args.documentId),
    });
  });

  registerTool(server, env, mcpChangePageComments, async (args, extra) => {
    const api = await knowledgeApi(server, env, extra);
    const { applied, failure } = await applyPageCommentChanges(
      api,
      args.documentId,
      args.page,
      args.changes,
    );
    if (failure) {
      const refusal = apiRefusalOf(failure);
      if (!refusal) throw failure;
      const before = applied.length
        ? ` Applied before it: ${applied.join('; ')}.`
        : ' Nothing was applied.';
      return errorResult(`${refusal.message}${before}`);
    }
    return textResult({ applied, url: deepLink(env, args.documentId) });
  });
}
