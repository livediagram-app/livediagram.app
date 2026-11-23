// The tools that change a knowledgebase's pages (docs/specs/024-agents/knowledgebase-for-agents.md "MCP tools"):
// create_page and suggest_edit (the `suggest` scope), write_page and move_page (the `write` scope). Each is one
// request to the api, which holds the rules: the scopes, the share roles, and that an agent never rewrites a
// verified page. A refusal comes back in the api's own words, naming what to call instead (tool-annotations.ts).
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type {
  CreatePageResponse,
  MovePageResponse,
  PagesAnswer,
  SuggestEditResponse,
} from '@liveknowledge/api-schema';
import {
  SUGGEST_MAX_CHARS,
  mcpCreatePage,
  mcpMovePage,
  mcpSuggestEdit,
  mcpWritePage,
} from '@liveknowledge/agent-verbs/mcp';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { jsonBody, knowledgePath } from '@liveknowledge/agent-verbs';
import { knowledgeApi } from './knowledge-client';
import { registerTool } from './tool-annotations';
import { deepLink, errorResult, textResult } from './tool-helpers';

export function registerKnowledgeWriteTools(server: McpServer, env: Env): void {
  registerTool(server, env, mcpCreatePage, async (args, extra) => {
    const api = await knowledgeApi(server, env, extra);
    const { page, trust } = await api.json<CreatePageResponse>(
      knowledgePath(args.documentId, 'pages'),
      jsonBody('POST', {
        title: args.title,
        markdown: args.markdown,
        ...(args.parent ? { parent: args.parent } : {}),
      }),
    );
    return textResult({
      page: page.tab,
      title: page.title,
      ...(page.parent ? { parent: page.parent } : {}),
      verified: trust ?? 'never-verified',
      url: deepLink(env, args.documentId),
      // Verification off (review_period "never"): nobody verifies it, so it is not called a draft.
      next:
        trust === 'off'
          ? 'The page is there to read: this knowledgebase does not verify pages. read_page reads it back; suggest_edit proposes a change to it.'
          : 'The page is a draft until a person verifies it: tell the user it is there to review. read_page reads it back; suggest_edit proposes a change to it.',
    });
  });

  registerTool(server, env, mcpSuggestEdit, async (args, extra) => {
    // The whole suggestion is bounded, not each part: said here, before the api counts it the same way.
    const size = args.reason.length + args.new_text.length + (args.old_text?.length ?? 0);
    if (size > SUGGEST_MAX_CHARS)
      return errorResult(
        `A suggestion is at most ${SUGGEST_MAX_CHARS} characters (reason, old_text and new_text together); this one is ${size}. Suggest a smaller passage, or several suggestions.`,
      );
    const api = await knowledgeApi(server, env, extra);
    const { suggestion, pending } = await api.json<SuggestEditResponse>(
      knowledgePath(args.documentId, 'pages', args.page, 'suggestions'),
      jsonBody('POST', {
        reason: args.reason,
        after: args.new_text,
        ...(args.old_text ? { before: args.old_text } : {}),
      }),
    );
    return textResult({
      suggestion: suggestion.id,
      page: suggestion.tab,
      title: suggestion.title,
      kind: suggestion.kind,
      pending,
      url: deepLink(env, args.documentId),
      next: 'Nothing changed yet: an Editor accepts or dismisses it under Insights, Edits Suggested by Agents. Tell the user it waits there.',
    });
  });

  registerTool(server, env, mcpWritePage, async (args, extra) => {
    const api = await knowledgeApi(server, env, extra);
    const answer = await api.json<PagesAnswer>(
      knowledgePath(args.documentId, 'pages', args.page),
      jsonBody('PUT', {
        ...(args.markdown !== undefined ? { markdown: args.markdown } : {}),
        ...(args.mode ? { mode: args.mode } : {}),
        // The page's cover (page-surface.md "The cover"): null takes it away.
        ...(args.cover !== undefined ? { cover: args.cover } : {}),
      }),
    );
    return textResult({
      page: answer.tab.id,
      rev: answer.tab.rev,
      lines: answer.lines,
      url: deepLink(env, args.documentId),
      next:
        args.markdown === undefined
          ? 'The cover changed at once. read_page reads it back.'
          : 'The page changed at once and is not verified by this write. read_page reads it back.',
    });
  });

  registerTool(server, env, mcpMovePage, async (args, extra) => {
    const api = await knowledgeApi(server, env, extra);
    const { page } = await api.json<MovePageResponse>(
      knowledgePath(args.documentId, 'pages', args.page, 'move'),
      // No parent beside a `before` goes where that page is; neither is the top level, said as null.
      jsonBody('POST', {
        ...(args.parent ? { parent: args.parent } : args.before ? {} : { parent: null }),
        ...(args.before ? { before: args.before } : {}),
      }),
    );
    return textResult({
      page: page.tab,
      title: page.title,
      ...(page.parent ? { parent: page.parent } : {}),
      depth: page.depth,
      next: 'list_pages shows the tree as it is now.',
    });
  });
}
