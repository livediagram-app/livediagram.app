// The tools that read a knowledgebase (docs/specs/024-agents/knowledgebase-for-agents.md "MCP tools"): get_context,
// list_pages, search_pages, read_page, and report_gap for what none of them held. Each is ONE request to the api
// (routes/knowledge-agent-routes.ts, knowledge-search-route.ts), carries the trust fields on every page and passage,
// answers a small part by default, and names the next tool to call.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type {
  KnowledgeAgentContextResponse,
  KnowledgePageReadResponse,
  KnowledgePageRow,
  KnowledgePagesResponse,
  KnowledgeSearchResponse,
} from '@liveknowledge/api-schema';
import {
  LIST_PAGES_DEFAULT_LIMIT,
  READ_PAGE_DEFAULT_CHARS,
  SEARCH_DEFAULT_LIMIT,
  mcpGetContext,
  mcpListPages,
  mcpReadPage,
  mcpReportGap,
  mcpSearchPages,
} from '@liveknowledge/agent-verbs/mcp';
import type { Env } from '@liveworkspace/mcp-kit/env';
import {
  jsonBody,
  knowledgePath,
  pageRefOf,
  resultTrustOf,
  reviewPeriodOf,
  trustFieldsOf,
} from '@liveknowledge/agent-verbs';
import { knowledgeApi } from './knowledge-client';
import { pageRowNamed } from './page-named';
import { registerTool } from './tool-annotations';
import { textResult } from './tool-helpers';

const ref = pageRefOf;

const rowOf = (row: KnowledgePageRow) => ({
  ...ref(row),
  depth: row.depth,
  ...(row.parent ? { parent: row.parent } : {}),
  subpages: row.subpages,
  ...(row.owner ? { owner: row.owner } : {}),
  ...(row.context ? { always_in_context: true as const } : {}),
  ...trustFieldsOf(row.trust),
});

export function registerKnowledgeReadTools(server: McpServer, env: Env): void {
  registerTool(server, env, mcpGetContext, async (args, extra) => {
    const api = await knowledgeApi(server, env, extra);
    const context = await api.json<KnowledgeAgentContextResponse>(
      knowledgePath(args.documentId, 'context'),
    );
    const leftOut = context.leftOut.map((p) => ({ ...ref(p), tokens: p.tokens }));
    return textResult({
      knowledgebase: context.name,
      role: context.role,
      scopes: context.scopes,
      review_period: reviewPeriodOf(context.reviewEvery),
      budget_tokens: context.budget,
      tokens: context.tokens,
      pages: context.pages.map((p) => ({
        ...ref(p),
        markdown: p.markdown,
        tokens: p.tokens,
        ...trustFieldsOf(p.trust),
      })),
      left_out: leftOut,
      page_count: context.pageCount,
      next:
        (context.pages.length === 0
          ? 'No page is marked Always in Context. '
          : leftOut.length > 0
            ? `read_page reads a page in left_out (${leftOut.length} did not fit the budget). `
            : '') +
        'search_pages with a query for what the task needs, or list_pages for the page tree.',
    });
  });

  registerTool(server, env, mcpListPages, async (args, extra) => {
    const api = await knowledgeApi(server, env, extra);
    const { pages, reviewEvery } = await api.json<KnowledgePagesResponse>(
      knowledgePath(args.documentId, 'pages'),
    );
    let rows = pages;
    if (args.under !== undefined) {
      // A page and the rows under it: the tree is in order, so they follow it until the depth comes back up.
      const top = pageRowNamed(pages, args.under);
      const at = pages.indexOf(top);
      const end = pages.findIndex((p, i) => i > at && p.depth <= top.depth);
      rows = pages.slice(at, end < 0 ? pages.length : end);
    }
    const offset = args.offset ?? 0;
    const shown = rows.slice(offset, offset + (args.limit ?? LIST_PAGES_DEFAULT_LIMIT));
    const more = Math.max(0, rows.length - offset - shown.length);
    return textResult({
      count: rows.length,
      review_period: reviewPeriodOf(reviewEvery),
      pages: shown.map(rowOf),
      more,
      next:
        (more > 0
          ? `list_pages again with offset ${offset + shown.length} for the next rows. `
          : '') + 'read_page with a page’s id or title reads it; search_pages finds a passage.',
    });
  });

  registerTool(server, env, mcpSearchPages, async (args, extra) => {
    const api = await knowledgeApi(server, env, extra);
    const { results } = await api.json<KnowledgeSearchResponse>(
      `${knowledgePath(args.documentId, 'search')}?q=${encodeURIComponent(args.query)}`,
    );
    const shown = results.slice(0, args.limit ?? SEARCH_DEFAULT_LIMIT);
    const disputed = shown.some((r) => r.conflictsWith?.length);
    return textResult({
      count: shown.length,
      results: shown.map((r) => ({
        ...ref(r),
        ...(r.headings.length > 0 ? { heading: r.headings.join(' > ') } : {}),
        ...(r.isTitle || r.text === undefined ? {} : { passage: r.text }),
        ...resultTrustOf(r),
      })),
      more: results.length - shown.length,
      next:
        shown.length === 0
          ? 'Nothing matches (the search was recorded as a question the knowledgebase could not answer). Try other words, list_pages for the tree, or report_gap with the user’s question.'
          : (disputed
              ? 'A result has conflicts_with: read_page both pages and tell the user they disagree. '
              : '') +
            'read_page with a result’s page (and its heading) for the writing around a passage.',
    });
  });

  registerTool(server, env, mcpReadPage, async (args, extra) => {
    const api = await knowledgeApi(server, env, extra);
    const query = new URLSearchParams({
      maxChars: String(args.max_chars ?? READ_PAGE_DEFAULT_CHARS),
      ...(args.heading ? { heading: args.heading } : {}),
    });
    const { page } = await api.json<KnowledgePageReadResponse>(
      `${knowledgePath(args.documentId, 'pages', args.page)}?${query.toString()}`,
    );
    return textResult({
      ...ref(page),
      rev: page.rev,
      markdown: page.markdown,
      chars: page.chars,
      left_out: page.leftOut,
      headings: page.headings,
      ...(page.parent ? { parent: page.parent } : {}),
      backlinks: page.backlinks.map(ref),
      subpages: page.subpages.map(ref),
      ...(page.cover ? { cover: page.cover } : {}),
      ...trustFieldsOf(page.trust),
      next:
        (page.leftOut > 0
          ? `${page.leftOut} characters of this page were left out: read_page again with heading (one of headings) for a section, or max_chars ${page.chars} for all of it. `
          : '') +
        'suggest_edit proposes a change to this page; report_gap records a question it does not answer.',
    });
  });

  registerTool(server, env, mcpReportGap, async (args, extra) => {
    const api = await knowledgeApi(server, env, extra);
    await api.json<{ key: string }>(
      knowledgePath(args.documentId, 'questions'),
      jsonBody('POST', { question: args.question }),
    );
    return textResult({
      recorded: true as const,
      next: 'Tell the user the knowledgebase does not cover this, and that the team has been told. create_page drafts the missing page if the user gives you the answer.',
    });
  });
}
