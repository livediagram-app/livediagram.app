// The knowledge routes of a knowledgebase (docs/specs/015-api/api.md "Knowledge"), each under
// /api/documents/<id>/ and answered inside the document's room:
//   GET    search?q=                     knowledge-search-route.ts
//   GET    summary                       Home's numbers, cacheable for a minute
//   GET    knowledge-settings, PUT knowledge-settings, GET knowledge-settings/preview
//                                        the Review Period (knowledge-settings-routes.ts)
//   GET    pages/<tab>/backlinks         knowledge-page-routes.ts
//   GET    pages/<tab>/health
//   POST   pages/<tab>/verify
//   PUT    pages/<tab>/knowledge
//   POST   pages/<tab>/approval                             knowledge-approval-route.ts
//   GET    pages/<tab>/threads, POST pages/<tab>/threads    knowledge-thread-routes.ts
//   GET    ai, PUT ai/key, DELETE ai/key, PUT ai/model      knowledge-ai-routes.ts
//   POST   ask                                              knowledge-ask-route.ts
//   POST   setup/suggest                                    knowledge-setup-route.ts
//   GET    knowledge, POST questions, DELETE questions/<key>, POST conflicts/<id>/dismiss
//                                                           knowledge-overview-routes.ts
//   POST   conflicts/<id>/ask-owners, POST knowledge/remind-owners
//                                                           knowledge-email-routes.ts
//   POST   pages/<tab>/suggestions, GET suggestions, POST suggestions/<id>/accept, POST suggestions/<id>/dismiss
//                                                           knowledge-suggestion-routes.ts
//   GET    pages, GET pages/<tab>, GET context, POST pages, POST pages/<tab>/move, PUT agents/<token>/scopes
//                                                           knowledge-agent-routes.ts
// The gate is the caller's grant (routes/context.ts): reading is every role's, a share link's visitor included; a
// write is an Editor's. A link confined to one page reaches that page's own routes and search, nothing else.
import { handlePublishingRoutes } from '../publishing/publishing-routes';
import { getDocument } from '../db';
import { redactDocumentForScope } from '../redact-document';
import { knowledgeHealthCounts, ownDuePages, recentPages } from '../knowledge/knowledge-reads';
import { awaitingApproval } from '../knowledge/page-approvals';
import { pageNamed, pageUnknownBody } from '../knowledge/page-read';
import { forbidden, json, methodNotAllowed, notFound } from '../responses';
import type { DocumentDTO } from '../types';
import {
  gateGrant,
  missingDocument,
  type DocumentAccess,
  type DocumentRouteContext,
  writesPages,
} from './context';
import { handleAgentPageRoute, handleAgentRoutes } from './knowledge-agent-routes';
import { accountOf, readerOf } from '../knowledge/knowledge-caller';
import { doorOf, noteAgentSeen } from '../knowledge/agent-seen';
import { frontDoorOf } from '../changesets/front-door';
import { handleAiRoutes } from './knowledge-ai-routes';
import { handleApproval } from './knowledge-approval-route';
import { handlePageThreads } from './knowledge-thread-routes';
import { handlePageReactions } from './knowledge-reaction-routes';
import { handleAsk } from './knowledge-ask-route';
import { handleEmailRoutes } from './knowledge-email-routes';
import { handleOverviewRoutes } from './knowledge-overview-routes';
import {
  handleBacklinks,
  handleKnowledgePatch,
  handlePageHealth,
  handleVerify,
} from './knowledge-page-routes';
import { handleKnowledgeSearch } from './knowledge-search-route';
import { handleSettingsRoutes } from './knowledge-settings-routes';
import { handleSetupSuggest } from './knowledge-setup-route';
import { handleSuggest, handleSuggestionRoutes } from './knowledge-suggestion-routes';

/** How long a client may keep the summary (knowledgebase-home.md: "cached for a minute"). */
export const SUMMARY_MAX_AGE_SECONDS = 60;

export type KnowledgeRoute = {
  ctx: DocumentRouteContext;
  document: DocumentDTO;
  grant: DocumentAccess;
};

const safeDecode = (segment: string) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return '';
  }
};
/** Whole-knowledgebase routes are closed to a link confined to one page. */
const wholeKnowledgebase = (grant: DocumentAccess) => grant.tabScope === null;

async function handleSummary({ ctx, document, grant }: KnowledgeRoute): Promise<Response> {
  const now = Date.now();
  // Yours to Review is the caller's own: a guest, or a visitor through a link, owns no page.
  const account = accountOf(ctx);
  // The Review Period, read once with the document: the counts and the due pages are worked out under it.
  const { reviewEvery } = document.knowledgeSettings;
  // Waiting for Your Approval (approval.md): for a person who may decide, the pages others asked about.
  const decides = account && !ctx.token && (grant.role === 'edit' || grant.role === 'participate');
  const [health, recent, yoursToReview, awaiting] = await Promise.all([
    knowledgeHealthCounts(ctx.env, document.id, reviewEvery, now),
    recentPages(ctx.env, document.id),
    account ? ownDuePages(ctx.env, document.id, account, reviewEvery, now) : [],
    decides ? awaitingApproval(ctx.env, document.id, account) : [],
  ]);
  return json(
    { pages: health.total, reviewEvery, health, recent, yoursToReview, awaitingApproval: awaiting },
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
  // A link confined to one page sees no other page (tab-scoped-share-links.md): every page route below reads the
  // knowledgebase as its visitor's copy holds it, the other pages nameless, and never moves the page in the tree.
  if (grant.tabScope !== null && segments[5] === 'move') return forbidden();
  const seen: KnowledgeRoute =
    grant.tabScope === null
      ? route
      : { ...route, document: redactDocumentForScope(document, grant.tabScope) };
  // The page as Markdown, and its place in the tree (knowledge-agent-routes.ts).
  const agent = await handleAgentPageRoute(seen, summary);
  if (agent) return agent;
  if (segments.length !== 6) return notFound();
  if (segments[5] === 'suggestions')
    return method === 'POST' ? handleSuggest(seen, tab) : methodNotAllowed();
  if (segments[5] === 'backlinks')
    return method === 'GET' ? handleBacklinks(ctx, seen.document, tab) : methodNotAllowed();
  if (segments[5] === 'health')
    return method === 'GET' ? handlePageHealth(ctx, seen.document, tab, grant) : methodNotAllowed();
  if (segments[5] === 'threads') return handlePageThreads(ctx, document, grant, tab);
  // Every signed-in reader's, a Viewer's too (page-reactions.md "Share roles").
  if (segments[5] === 'reactions') return handlePageReactions(ctx, document, tab);
  if (segments[5] === 'approval')
    return method === 'POST' ? handleApproval(ctx, document, grant, tab) : methodNotAllowed();
  if (segments[5] !== 'verify' && segments[5] !== 'knowledge') return notFound();
  if (method !== (segments[5] === 'verify' ? 'POST' : 'PUT')) return methodNotAllowed();
  // Verify, owner and Always in Context: an Editor's or a Participant's, and the whole knowledgebase's to decide.
  if (!writesPages(grant) || !wholeKnowledgebase(grant)) return forbidden();
  // A person vouches for a page (verification.md "Share roles"), never an agent, as approval (approval.md). Its owner
  // and Always in Context are a person's too: what is in context is handed to every agent (security review
  // 2026-11-21).
  if (ctx.token)
    return json(
      {
        error: 'needs_a_person',
        message:
          segments[5] === 'verify'
            ? 'A person verifies a page, never an agent.'
            : "A person sets a page's owner and Always in Context, never an agent.",
      },
      { status: 403 },
    );
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
      segments[3] === 'knowledge-settings' ||
      segments[3] === 'publishing' ||
      segments[3] === 'questions' ||
      segments[3] === 'pages' ||
      segments[3] === 'context' ||
      segments[3] === 'suggestions'
    );
  if (segments.length === 5)
    return (
      (segments[3] === 'ai' && (segments[4] === 'key' || segments[4] === 'model')) ||
      (segments[3] === 'knowledge' && segments[4] === 'remind-owners') ||
      (segments[3] === 'knowledge-settings' && segments[4] === 'preview') ||
      (segments[3] === 'setup' && segments[4] === 'suggest') ||
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
          segments[5] === 'approval' ||
          segments[5] === 'threads' ||
          segments[5] === 'reactions' ||
          segments[5] === 'suggestions' ||
          segments[5] === 'move')) ||
      (segments[3] === 'conflicts' &&
        (segments[5] === 'dismiss' || segments[5] === 'ask-owners')) ||
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
  // A token that calls here is a connection AI Knowledge lists (knowledge/agent-seen.ts): one guarded upsert, a
  // write an hour at most.
  if (ctx.token && ctx.agent) {
    const reader = readerOf(ctx);
    await noteAgentSeen(ctx.env, {
      tokenId: ctx.token.id,
      name: reader.kind === 'agent' ? reader.name : 'API Token',
      door: doorOf(frontDoorOf(request)),
      readOnly: ctx.agent.readOnly,
      personRole: grant.personRole,
    }).catch((error) =>
      console.warn('[knowledge] agent not noted', { documentId: id, error: String(error) }),
    );
  }
  if (segments[3] === 'pages' && segments.length > 4) return handlePageRoutes(route);
  if (segments[3] === 'search')
    return request.method === 'GET' ? handleKnowledgeSearch(route) : methodNotAllowed();
  if (!wholeKnowledgebase(grant)) return forbidden();
  if (segments[3] === 'summary')
    return request.method === 'GET' ? handleSummary(route) : methodNotAllowed();
  if (segments[3] === 'ai') return handleAiRoutes(route);
  if (segments[3] === 'ask')
    return request.method === 'POST' ? handleAsk(route) : methodNotAllowed();
  if (segments[3] === 'setup')
    return request.method === 'POST' ? handleSetupSuggest(route) : methodNotAllowed();
  return (
    (await handlePublishingRoutes(route)) ??
    (await handleSettingsRoutes(route)) ??
    (await handleAgentRoutes(route)) ??
    (await handleSuggestionRoutes(route)) ??
    (await handleEmailRoutes(route)) ??
    (await handleOverviewRoutes(route)) ??
    notFound()
  );
}
