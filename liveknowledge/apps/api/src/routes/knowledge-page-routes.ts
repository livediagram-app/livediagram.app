// A page's knowledge over REST (docs/specs/030-knowledgebase/verification.md, links-and-embeds.md "Backlinks",
// insights.md "Always in Context"):
//   GET   /api/documents/<id>/pages/<tab>/backlinks   the pages whose writing links here, in tree order
//   GET   /api/documents/<id>/pages/<tab>/health      the fields, the state, the week's reads (Page Health), and
//                                                    AI Context: the questions answered from it, its agents
//   POST  /api/documents/<id>/pages/<tab>/verify      Verify: now, by the caller, who owns a page with no owner
//   PUT   /api/documents/<id>/pages/<tab>/knowledge   owner, Always in Context (each optional)
// Reading is every role's; Verify and the fields are an Editor's (verification.md "Share roles"). When a page's
// review comes due is the knowledgebase's Review Period (knowledge-settings-routes.ts), never the page's.
import { getParticipants } from '../person/profiles';
import { readPageAuthors } from '../knowledge/page-authors';
import { guestOwnersOf, guestStampNamer } from '../knowledge/page-writer';
import { readPageEditors } from '../knowledge/page-editors';
import { pageHealthRows } from '../knowledge/page-health-read';
import { verifyMoment } from '../knowledge/model-door';
import { pageTreeRows } from '@liveknowledge/document';
import {
  CONTEXT_BUDGET_TOKENS,
  backlinkRows,
  backlinks,
  countPageAgentReads,
  countPageDailyReads,
  fitsContextBudget,
  listPageAnswers,
  pageInsights,
  tokensOfChars,
  verified,
  guestVerifier,
  type KnowledgeFields,
  type PageAgentReadsRow,
  type DailyReadsRow,
  type PageAnswerRow,
} from '@liveknowledge/knowledge';
import { isAccountIdShape, type PageKnowledgePatch } from '@liveknowledge/api-schema';
import { accountOf } from '../knowledge/knowledge-caller';
import { rowsOf } from '../knowledge/knowledge-db';
import { contextPages } from '../knowledge/knowledge-reads';
import {
  pageKnowledgeOf,
  readPageKnowledge,
  type StoredPageKnowledge,
} from '../knowledge/page-knowledge';
import { personCanOpen, savePageFields } from '../knowledge/page-fields-save';
import {
  countSuggestionsByPage,
  listPageSuggestions,
  suggestionOf,
} from '../knowledge/suggestions';
import { routeWho } from '../document-room/automations/knowledge-who';
import { readStoredPages } from '../document-room/page-tree-store';
import { conflict, json, notFound } from '../responses';
import type { DocumentDTO } from '../types';
import { readerOf } from '../knowledge/knowledge-caller';
import { countRead } from '../knowledge/knowledge-reads';
import type { DocumentAccess, DocumentRouteContext } from './context';

const invalid = (error: string, message: string) => json({ error, message }, { status: 400 });

export async function handleBacklinks(
  ctx: DocumentRouteContext,
  document: DocumentDTO,
  tab: string,
): Promise<Response> {
  const [linking, pages] = await Promise.all([
    rowsOf<{ fromTab: string }>(ctx.env, backlinkRows(tab)),
    readStoredPages(ctx.env, document.id),
  ]);
  // A page a link confined to another cannot see is no backlink of its (the routes hand it the visitor's copy).
  const titles = new Map(document.tabs.filter((t) => !t.outOfScope).map((t) => [t.id, t.name]));
  const order = pageTreeRows(pages)
    .map((row) => row.page.id)
    .filter((id) => titles.has(id));
  return json({
    backlinks: backlinks(
      tab,
      linking.map((r) => r.fromTab),
      order,
    ).map((id) => ({ tab: id, title: titles.get(id) ?? '' })),
  });
}

export async function handlePageHealth(
  ctx: DocumentRouteContext,
  document: DocumentDTO,
  tab: string,
  grant: Pick<DocumentAccess, 'tabScope'>,
): Promise<Response> {
  const now = Date.now();
  const page = await readPageKnowledge(ctx.env, document.id, tab);
  if (!page) return notFound();
  // A person opening the page in the editor (`?opened=1`) is a read (insights.md "Reads"), counted before the
  // week's figures are, so the figures they get back hold it. Once a person a page a day, as countRead keeps; an
  // agent's token counts its reads through its own routes, never here.
  if (!ctx.token && new URL(ctx.request.url).searchParams.get('opened') === '1') {
    const person = ctx.resolveOwner();
    if (person) await countRead(ctx.env, tab, readerOf(ctx), person, now);
  }
  // AI Context (insights.md "AI Context on a page") rides this read: the questions a range of their
  // table's key, the agents a range of `page_reads_tab` (schema step V19).
  // The Health Score's counts the editor cannot see itself (verification.md "Health Score"): one read of the page's
  // facts row, on indexes its tables already have. Page Insights (insights.md) rides the reads, 30 days by day
  // (the week summed from them), and the questions, whose window total is how often Ask cited the page.
  // The page's suggested edits and every page's count (insights.md "On the page") ride this read too: one read
  // on `suggestions_tab` and one grouped count of a table of at most 50 rows, so the meta row, the rail and the tree's
  // dots make no request of their own.
  const [readRows, authors, editors, answered, agents, [facts], pageSuggestions, counts] =
    await Promise.all([
      rowsOf<DailyReadsRow>(ctx.env, countPageDailyReads(tab, now)),
      readPageAuthors(ctx.env, tab),
      readPageEditors(ctx.env, tab),
      rowsOf<PageAnswerRow>(ctx.env, listPageAnswers(tab, now)),
      rowsOf<PageAgentReadsRow>(ctx.env, countPageAgentReads(tab, now)),
      pageHealthRows(ctx.env, document.id, now, [tab]),
      listPageSuggestions(ctx.env, tab, now),
      countSuggestionsByPage(ctx.env, now),
    ]);
  const knowledge = pageKnowledgeOf(page, document.knowledgeSettings.reviewEvery, now);
  const use = pageInsights(readRows, now);
  // The questions are the knowledgebase's Ask, which a link confined to one page has not (search-and-ask.md).
  const wholeKnowledgebase = grant.tabScope === null;
  // A guest's stamp holds their owner id, a credential: it never leaves here. It reads as the name on their profile,
  // "Bright Marlin (Guest)" (owner 2026-11-21), the way a guest's Verify is stored (guestVerifier). The accounts the
  // page names (who made and changed it, its owner, who verified it) go with their names, so a reader outside the
  // team (a Viewer through a link) sees people, never "Guest" (owner 2026-11-21). One profiles read for both.
  const { named, names } = await stampsNamed(
    ctx,
    [...(authors ? [authors.created, authors.updated] : []), ...editors],
    [knowledge.owner, knowledge.verifiedBy],
  );
  return json({
    knowledge,
    ...(Object.keys(names).length > 0 ? { names } : {}),
    reads: use.week,
    ...(authors ? { created: named(authors.created), updated: named(authors.updated) } : {}),
    ...(editors.length > 0 ? { editors: editors.map(named) } : {}),
    answered: wholeKnowledgebase
      ? answered.map((r) => ({ question: r.question, asked: r.asked }))
      : [],
    insights: {
      days: use.days,
      ...(wholeKnowledgebase ? { cited: answered[0]?.cited ?? 0 } : {}),
    },
    agents: agents.map((r) => ({ agent: r.agent, reads: r.reads })),
    suggestions: pageSuggestions.map((sg) =>
      suggestionOf(sg, document.tabs.find((t) => t.id === tab)?.name ?? ''),
    ),
    suggestionCounts: visibleCounts(document, grant, counts),
    ...(facts
      ? {
          signals: {
            openConflicts: facts.openConflicts,
            openThreads: facts.openThreads,
            suggestions: facts.suggestions,
            backlinks: facts.backlinks,
          },
        }
      : {}),
  });
}

// The pending counts a reader may see: the pages of their copy of the knowledgebase (a link confined to one page has
// that page alone), never a page out of their scope.
function visibleCounts(
  document: DocumentDTO,
  grant: Pick<DocumentAccess, 'tabScope'>,
  counts: ReadonlyMap<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of document.tabs) {
    const n = counts.get(t.id);
    if (!n || t.outOfScope) continue;
    if (grant.tabScope !== null && grant.tabScope !== t.id) continue;
    out[t.id] = n;
  }
  return out;
}

// The write (knowledge/page-fields-save.ts): at the revision read, repeated once when the tab moved, told to every
// open editor, and heard by the knowledgebase's own triggers as the caller's. `also` rides the write's transaction
// (writePageKnowledge).
export async function saveFields(
  ctx: DocumentRouteContext,
  document: DocumentDTO,
  tab: string,
  change: (page: StoredPageKnowledge) => Promise<KnowledgeFields | Response>,
  opts: { verified?: boolean; also?: (rev: number) => D1PreparedStatement[] } = {},
): Promise<Response> {
  const saved = await savePageFields<Response>(
    ctx.env,
    document.id,
    tab,
    async (page) => {
      const next = await change(page);
      return next instanceof Response ? { refused: next } : next;
    },
    { ...opts, who: () => routeWho(ctx) },
  );
  if (saved.kind === 'gone') return notFound();
  if (saved.kind === 'busy') return conflict('tab_busy');
  if (saved.kind === 'refused') return saved.refusal;
  return json({
    knowledge: pageKnowledgeOf(saved.after, document.knowledgeSettings.reviewEvery, saved.now),
  });
}

export async function handleVerify(
  ctx: DocumentRouteContext,
  document: DocumentDTO,
  tab: string,
): Promise<Response> {
  // Verify says who vouches for the page: an account, or "Guest" for a guest writer (GUEST_VERIFIER), never a guest's
  // or a link visitor's own id.
  // A guest's says their cursor's name, "Bright Marlin (Guest)" (owner 2026-11-21), from the body when sent.
  const account = accountOf(ctx);
  let sent: unknown;
  if (!account)
    sent = await ctx.request.json().then(
      (b) => (b as { name?: unknown } | null)?.name,
      () => undefined,
    );
  const person = account ?? guestVerifier(typeof sent === 'string' ? sent : undefined);
  // Now; the e2e stack alone may say earlier (verifyMoment).
  const at = verifyMoment(ctx.env, ctx.request, Date.now());
  return saveFields(ctx, document, tab, async (page) => verified(page.fields, person, at), {
    verified: true,
  });
}

// Whether a person may own a page: they can open the knowledgebase. The caller and the knowledgebase's own owner
// can; anyone else is asked of the index, as that person with no team named (a member who reaches it only through
// a team is therefore refused: the index has no "who can open this" read yet).
async function hasAccess(
  ctx: DocumentRouteContext,
  document: DocumentDTO,
  person: string,
): Promise<boolean> {
  return person === accountOf(ctx) || personCanOpen(ctx.env, document, person);
}

export async function handleKnowledgePatch(
  ctx: DocumentRouteContext,
  document: DocumentDTO,
  tab: string,
): Promise<Response> {
  const body = (await ctx.request.json().catch(() => null)) as PageKnowledgePatch | null;
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return invalid('invalid_body', 'Send owner or context.');
  // A page has no review period of its own (verification.md "The fields").
  if ('reviewEvery' in body)
    return invalid(
      'review_period_is_the_knowledgebases',
      'A page has no review period of its own. Set the Review Period for the whole knowledgebase: PUT /api/documents/<id>/knowledge-settings with { "reviewEvery": 30 | 90 | 180 | 365 | "never" }.',
    );
  const { owner, context } = body;
  if (
    owner !== undefined &&
    owner !== null &&
    (typeof owner !== 'string' || !owner || owner.length > 128)
  )
    return invalid('invalid_owner', 'owner is an account id, or null for none.');
  if (context !== undefined && typeof context !== 'boolean')
    return invalid('invalid_context', 'context is true or false.');
  if (owner === undefined && context === undefined)
    return invalid('invalid_body', 'Send owner or context.');
  if (typeof owner === 'string' && !(await hasAccess(ctx, document, owner)))
    return invalid('owner_no_access', 'The owner must be someone who can open this knowledgebase.');
  return saveFields(ctx, document, tab, async (page) => {
    const next: KnowledgeFields = { ...page.fields };
    if (owner === null) delete next.owner;
    else if (owner !== undefined) next.owner = owner;
    if (context === false) delete next.context;
    if (context === true && !page.fields.context) {
      // Always in Context holds what fits the budget every agent is handed (insights.md).
      const used = (await contextPages(ctx.env, document.id)).reduce((sum, p) => sum + p.tokens, 0);
      const tokens = tokensOfChars(page.chars);
      if (!fitsContextBudget(tokens, used))
        return json(
          {
            error: 'context_budget',
            message: `This page is ${tokens.toLocaleString('en')} tokens and ${used.toLocaleString('en')} of ${CONTEXT_BUDGET_TOKENS.toLocaleString('en')} are in use.`,
            tokens,
            used,
            budget: CONTEXT_BUDGET_TOKENS,
          },
          { status: 409 },
        );
      next.context = true;
    }
    return next;
  });
}

/** Swaps each guest's owner id on a stamp for its name (guestStampNamer), the names read from profiles in one call. */
async function stampsNamed<T extends { by: string }>(
  ctx: DocumentRouteContext,
  stamps: readonly T[],
  also: readonly (string | undefined)[],
): Promise<{ named: (stamp: T) => T; names: Record<string, string> }> {
  const guests = guestOwnersOf(stamps);
  const accounts = [
    ...new Set(
      [...stamps.map((s) => s.by), ...also].filter(
        (id): id is string => typeof id === 'string' && isAccountIdShape(id),
      ),
    ),
  ];
  if (guests.length === 0 && accounts.length === 0) return { named: (stamp) => stamp, names: {} };
  const people = await getParticipants(ctx.env, [...guests, ...accounts]).catch(
    () => new Map<string, { name: string }>(),
  );
  const names: Record<string, string> = {};
  for (const id of accounts) {
    const name = people.get(id)?.name.trim();
    if (name) names[id] = name;
  }
  return { named: guestStampNamer((id) => people.get(id)?.name), names };
}
