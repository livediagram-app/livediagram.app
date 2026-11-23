// GET /api/documents/<id>/search?q= (docs/specs/030-knowledgebase/search-and-ask.md "Search"): the knowledgebase's
// own index, page titles first, then passages, verified pages preferred. No model and no key. Every role, signed in
// or through a share link; a link confined to one page finds only that page.
import { newQuestions, queueNewQuestions } from '../document-room/automations/question-events';
import {
  SEARCH_MAX_QUERY_CHARS,
  foundPassage,
  questionKey,
  recordRead,
  searchPassages,
  upsertQuestion,
  type FoundPassage,
  type SearchRow,
  type SqlStatement,
} from '@liveknowledge/knowledge';
import type { KnowledgeSearchResult } from '@liveknowledge/api-schema';
import { clientRateKey } from '@liveworkspace/api-kit/client-ip';
import { readerOf } from '../knowledge/knowledge-caller';
import { labelScopeOf, labelsParam } from '../knowledge/label-scope';
import { rowsOf, runAll } from '../knowledge/knowledge-db';
import { openConflictPages, pageTrustOf } from '../knowledge/page-read';
import { pageHealthWires } from '../knowledge/page-health-read';
import { json, rateLimited } from '../responses';
import type { DocumentRouteContext } from './context';
import type { KnowledgeRoute } from './knowledge-routes';

const invalid = (error: string, message: string) => json({ error, message }, { status: 400 });

export const searchResultOf = (found: FoundPassage): KnowledgeSearchResult => ({
  id: found.id,
  tab: found.tab,
  isTitle: found.isTitle,
  title: found.title,
  titleMarked: found.titleMarked,
  headings: found.headings,
  snippet: found.snippet,
  firstBlock: found.firstBlock,
  lastBlock: found.lastBlock,
  trust: found.trust,
  ...(found.verifiedAt === undefined ? {} : { verifiedAt: found.verifiedAt }),
});

// One caller's searches a minute (wrangler.toml SEARCH_RATE_LIMITER): keyed on the token, the person, or the
// network of a visitor with neither. Absent binding: allowed, as every limiter of this Worker.
async function searchLimited(ctx: DocumentRouteContext): Promise<boolean> {
  const limiter = ctx.env.SEARCH_RATE_LIMITER;
  if (!limiter) return false;
  const who = ctx.token
    ? `token:${ctx.token.id}`
    : (ctx.resolveOwner() ?? clientRateKey(ctx.request));
  return !(await limiter.limit({ key: `search:${who}` })).success;
}

export async function handleKnowledgeSearch(route: KnowledgeRoute): Promise<Response> {
  const { ctx, grant } = route;
  const { reviewEvery } = route.document.knowledgeSettings;
  const query = ctx.url.searchParams.get('q') ?? '';
  if (query.length > SEARCH_MAX_QUERY_CHARS)
    return invalid('query_too_long', `A search is at most ${SEARCH_MAX_QUERY_CHARS} characters.`);
  // `labels=` looks only at the pages carrying any of them (search-and-ask.md "By label").
  const scope = labelScopeOf(route.document, labelsParam(ctx.url.searchParams));
  if (scope instanceof Response) return scope;
  if (await searchLimited(ctx)) return rateLimited();
  const now = Date.now();
  const statement =
    scope && scope.tabs.size === 0
      ? undefined
      : searchPassages(query, {
          now,
          reviewEvery,
          ...(scope ? { onlyTabs: [...scope.tabs] } : {}),
        });
  const found = statement ? (await rowsOf<SearchRow>(ctx.env, statement)).map(foundPassage) : [];
  // A link confined to one page (tab-scoped-share-links.md) finds only what that page holds.
  const results = grant.tabScope === null ? found : found.filter((r) => r.tab === grant.tabScope);
  const reader = readerOf(ctx);
  if (reader.kind === 'agent') {
    // An agent's results carry what it needs to judge them without a second request (knowledgebase-for-agents.md):
    // the passage whole, when its page's review is due, and the pages an open conflict sets it against.
    const { document } = route;
    const knowledge = new Map(document.tabs.map((t) => [t.id, t.knowledge]));
    const conflicts = results.length > 0 ? await openConflictPages(ctx.env, document.tabs) : null;
    // Each result's page's Health Score (verification.md "For agents and Ask"): one read for the results' pages,
    // never one a result.
    const health = await pageHealthWires(
      ctx.env,
      document.id,
      reviewEvery,
      now,
      results.map((r) => r.tab),
    );
    const answered = results.map((found) => {
      const trust = pageTrustOf(knowledge.get(found.tab), reviewEvery, now);
      const against = conflicts?.byPassage.get(found.id);
      return {
        ...searchResultOf(found),
        ...(found.isTitle ? {} : { text: found.text }),
        ...(trust.reviewAt === undefined ? {} : { reviewAt: trust.reviewAt }),
        ...(against?.length ? { conflictsWith: against } : {}),
        ...(health.has(found.tab) ? { health: health.get(found.tab)! } : {}),
      };
    });
    // Each result served to an agent is a read of its page; a search that found nothing is a question nobody
    // could answer (ai-knowledge.md "Reads", "Questions nobody could answer").
    const notes: SqlStatement[] = [...new Set(results.map((r) => r.tab))].map((tab) =>
      recordRead(tab, reader, now),
    );
    const key = questionKey(query);
    // A scoped search that finds nothing proves nothing of the rest of the knowledgebase: no question is recorded.
    const asked = results.length === 0 && key && !scope ? [{ key, question: query.trim() }] : [];
    const fresh = await newQuestions(ctx, asked);
    if (asked.length > 0) notes.push(...upsertQuestion(key, query.trim(), reader, now));
    await runAll(ctx.env, notes);
    await queueNewQuestions(ctx, fresh);
    return json({ results: answered });
  }
  return json({ results: results.map(searchResultOf) });
}
