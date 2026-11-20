// The knowledge routes of a knowledgebase (docs/specs/015-api/api.md "Knowledge"), each under
// /api/documents/<id>/ and answered inside the document's room:
//   GET    search?q=                     knowledge-search-route.ts
//   GET    summary                       Home's numbers, cacheable for a minute
//   GET    pages/<tab>/backlinks         knowledge-page-routes.ts
//   GET    pages/<tab>/health
//   POST   pages/<tab>/verify
//   PUT    pages/<tab>/knowledge
//   GET    ai, PUT ai/key, DELETE ai/key, PUT ai/model      knowledge-ai-routes.ts
//   POST   ask                                              knowledge-ask-route.ts
//   GET    knowledge, POST questions, DELETE questions/<key>, POST conflicts/<id>/dismiss
//                                                           knowledge-overview-routes.ts
//   POST   pages/<tab>/suggestions, GET suggestions, POST suggestions/<id>/accept, POST suggestions/<id>/dismiss
//                                                           knowledge-suggestion-routes.ts
//   GET    pages, GET pages/<tab>, GET context, POST pages, POST pages/<tab>/move, PUT agents/<token>/scopes
//                                                           knowledge-agent-routes.ts
// The gate is the caller's grant (routes/context.ts): reading is every role's, a share link's visitor included; a
// write is an Editor's. A link confined to one page reaches that page's own routes and search, nothing else.
import { getDocument } from '../db';
import { knowledgeHealthCounts, ownDuePages, recentPages } from '../knowledge/knowledge-reads';
import { pageNamed, pageUnknownBody } from '../knowledge/page-read';
import { forbidden, json, methodNotAllowed, notFound } from '../responses';
import type { DocumentDTO } from '../types';
import {
  gateGrant,
  missingDocument,
  type DocumentAccess,
  type DocumentRouteContext,
} from './context';
import { handleAgentPageRoute, handleAgentRoutes } from './knowledge-agent-routes';
import { accountOf } from '../knowledge/knowledge-caller';
import { handleAiRoutes } from './knowledge-ai-routes';
import { handleAsk } from './knowledge-ask-route';
import { handleOverviewRoutes } from './knowledge-overview-routes';
import {
  handleBacklinks,
  handleKnowledgePatch,
  handlePageHealth,
  handleVerify,
} from './knowledge-page-routes';
import { handleKnowledgeSearch } from './knowledge-search-route';
import { handleSuggest, handleSuggestionRoutes } from './knowledge-suggestion-routes';

/** How long a client may keep the summary (knowledgebase-home.md: "cached for a minute"). */
export const SUMMARY_MAX_AGE_SECONDS = 60;

export type KnowledgeRoute = {
  ctx: DocumentRouteContext;
  document: DocumentDTO;
  grant: DocumentAccess;
};

const isEditor = (grant: DocumentAccess) => grant.role === 'edit';
const safeDecode = (segment: string) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return '';
  }
};
/** Whole-knowledgebase routes are closed to a link confined to one page. */
const wholeKnowledgebase = (grant: DocumentAccess) => grant.tabScope === null;

async function handleSummary({ ctx, document }: KnowledgeRoute): Promise<Response> {
  const now = Date.now();
  // Yours to Review is the caller's own: a guest, or a visitor through a link, owns no page.
  const account = accountOf(ctx);
  const [health, recent, yoursToReview] = await Promise.all([
    knowledgeHealthCounts(ctx.env, document.id, now),
    recentPages(ctx.env, document.id),
    account ? ownDuePages(ctx.env, document.id, account, now) : [],
  ]);
  return json(
    { pages: health.total, health, recent, yoursToReview },
    { headers: { 'Cache-Control': `private, max-age=${SUMMARY_MAX_AGE_SECONDS}` } },
  );
}

async function handlePageRoutes(route: KnowledgeRoute): Promise<Response> {
  const { ctx, document, grant } = route;
  const { segments } = ctx;
  const ref = safeDecode(segments[4] ?? '');
  if (!ref) return notFound();
  // A page by its id, or by its title when one page alone has it. A link confined to one page names it by id, and
  // reads every other page as missing (tab-scoped-share-links.md): no title is looked up for it.
  const found = grant.tabScope === null ? pageNamed(document.tabs, ref) : undefined;
  const summary =
    grant.tabScope === null
      ? found
      : grant.tabScope === ref
        ? document.tabs.find((t) => t.id === ref)
        : undefined;
  if (!summary || summary === 'ambiguous') {
    if (grant.tabScope !== null) return notFound();
    return json(pageUnknownBody(document.tabs, ref, found === 'ambiguous' ? found : undefined), {
      status: 404,
    });
  }
  const tab = summary.id;
  const method = ctx.request.method;
  // The page as Markdown, and its place in the tree (knowledge-agent-routes.ts).
  const agent = await handleAgentPageRoute(route, summary);
  if (agent) return agent;
  if (segments.length !== 6) return notFound();
  if (segments[5] === 'suggestions')
    return method === 'POST' ? handleSuggest(route, tab) : methodNotAllowed();
  if (segments[5] === 'backlinks')
    return method === 'GET' ? handleBacklinks(ctx, document, tab) : methodNotAllowed();
  if (segments[5] === 'health')
    return method === 'GET' ? handlePageHealth(ctx, document, tab) : methodNotAllowed();
  if (segments[5] !== 'verify' && segments[5] !== 'knowledge') return notFound();
  if (method !== (segments[5] === 'verify' ? 'POST' : 'PUT')) return methodNotAllowed();
  // Verify, owner, interval and Always in Context: Editor only, and the whole knowledgebase's to decide.
  if (!isEditor(grant) || !wholeKnowledgebase(grant)) return forbidden();
  return segments[5] === 'verify'
    ? handleVerify(ctx, document, tab)
    : handleKnowledgePatch(ctx, document, tab);
}

// Whether the path has the shape of one of this file's routes, read by its literal segments and its length so the
// route probe sees every one (openapi/route-parity.test.ts). Any other path under these words is not this file's:
// it falls through to the dispatcher's own 404.
function isKnowledgePath(segments: readonly string[]): boolean {
  if (segments.length === 4)
    return (
      segments[3] === 'search' ||
      segments[3] === 'summary' ||
      segments[3] === 'ai' ||
      segments[3] === 'ask' ||
      segments[3] === 'knowledge' ||
      segments[3] === 'questions' ||
      segments[3] === 'pages' ||
      segments[3] === 'context' ||
      segments[3] === 'suggestions'
    );
  if (segments.length === 5)
    return (
      (segments[3] === 'ai' && (segments[4] === 'key' || segments[4] === 'model')) ||
      segments[3] === 'questions' ||
      segments[3] === 'pages'
    );
  if (segments.length === 6)
    return (
      (segments[3] === 'pages' &&
        (segments[5] === 'backlinks' ||
          segments[5] === 'health' ||
          segments[5] === 'verify' ||
          segments[5] === 'knowledge' ||
          segments[5] === 'suggestions' ||
          segments[5] === 'move')) ||
      (segments[3] === 'conflicts' && segments[5] === 'dismiss') ||
      (segments[3] === 'suggestions' && (segments[5] === 'accept' || segments[5] === 'dismiss')) ||
      (segments[3] === 'agents' && segments[5] === 'scopes')
    );
  return false;
}

/** Null when the path is not a knowledge route. */
export async function handleKnowledgeRoutes(ctx: DocumentRouteContext): Promise<Response | null> {
  const { segments, request } = ctx;
  const id = segments[2];
  if (segments[1] !== 'documents' || !id || !isKnowledgePath(segments)) return null;
  const document = await getDocument(ctx.env, id);
  if (!document) return missingDocument(ctx, id);
  const grant = await gateGrant(ctx, id, document.ownerId, document.teamId);
  if (!grant) return forbidden();
  const route: KnowledgeRoute = { ctx, document, grant };
  if (segments[3] === 'pages' && segments.length > 4) return handlePageRoutes(route);
  if (segments[3] === 'search')
    return request.method === 'GET' ? handleKnowledgeSearch(route) : methodNotAllowed();
  if (!wholeKnowledgebase(grant)) return forbidden();
  if (segments[3] === 'summary')
    return request.method === 'GET' ? handleSummary(route) : methodNotAllowed();
  if (segments[3] === 'ai') return handleAiRoutes(route);
  if (segments[3] === 'ask')
    return request.method === 'POST' ? handleAsk(route) : methodNotAllowed();
  return (
    (await handleAgentRoutes(route)) ??
    (await handleSuggestionRoutes(route)) ??
    (await handleOverviewRoutes(route)) ??
    notFound()
  );
}
