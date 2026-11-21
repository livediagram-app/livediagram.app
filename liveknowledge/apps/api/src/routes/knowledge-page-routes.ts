// A page's knowledge over REST (docs/specs/030-knowledgebase/verification.md, links-and-embeds.md "Backlinks",
// ai-knowledge.md "Always in Context"):
//   GET   /api/documents/<id>/pages/<tab>/backlinks   the pages whose writing links here, in tree order
//   GET   /api/documents/<id>/pages/<tab>/health      the fields, the state, the week's reads (Page Health), and
//                                                    AI Context: the questions answered from it, its agents
//   POST  /api/documents/<id>/pages/<tab>/verify      Verify: now, by the caller, who owns a page with no owner
//   PUT   /api/documents/<id>/pages/<tab>/knowledge   owner, Always in Context (each optional)
// Reading is every role's; Verify and the fields are an Editor's (verification.md "Share roles"). When a page's
// review comes due is the knowledgebase's Review Period (knowledge-settings-routes.ts), never the page's.
import { readPageAuthors } from '../knowledge/page-authors';
import { readPageEditors } from '../knowledge/page-editors';
import { verifyMoment } from '../knowledge/model-door';
import { pageTreeRows } from '@liveknowledge/document';
import {
  CONTEXT_BUDGET_TOKENS,
  backlinkRows,
  backlinks,
  countPageAgentReads,
  countPageReads,
  fitsContextBudget,
  listPageAnswers,
  pageReads,
  tokensOfChars,
  verified,
  guestVerifier,
  type KnowledgeFields,
  type PageAgentReadsRow,
  type PageAnswerRow,
  type PageReadsRow,
} from '@liveknowledge/knowledge';
import type { PageKnowledgePatch } from '@liveknowledge/api-schema';
import { accountOf } from '../knowledge/knowledge-caller';
import { rowsOf } from '../knowledge/knowledge-db';
import { contextPages } from '../knowledge/knowledge-reads';
import {
  pageKnowledgeOf,
  readPageKnowledge,
  type StoredPageKnowledge,
} from '../knowledge/page-knowledge';
import { personCanOpen, savePageFields } from '../knowledge/page-fields-save';
import { routeWho } from '../document-room/automations/knowledge-who';
import { readStoredPages } from '../document-room/page-tree-store';
import { conflict, json, notFound } from '../responses';
import type { DocumentDTO } from '../types';
import type { DocumentRouteContext } from './context';

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
  const titles = new Map(document.tabs.map((t) => [t.id, t.name]));
  const order = pageTreeRows(pages).map((row) => row.page.id);
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
): Promise<Response> {
  const now = Date.now();
  const page = await readPageKnowledge(ctx.env, document.id, tab);
  if (!page) return notFound();
  // AI Context (ai-knowledge.md "AI Context on a page") rides this read: the questions a range of their
  // table's key, the agents a range of `page_reads_tab` (schema step V19).
  const [readRows, authors, editors, answered, agents] = await Promise.all([
    rowsOf<PageReadsRow>(ctx.env, countPageReads(tab, now)),
    readPageAuthors(ctx.env, tab),
    readPageEditors(ctx.env, tab),
    rowsOf<PageAnswerRow>(ctx.env, listPageAnswers(tab, now)),
    rowsOf<PageAgentReadsRow>(ctx.env, countPageAgentReads(tab, now)),
  ]);
  return json({
    knowledge: pageKnowledgeOf(page, document.knowledgeSettings.reviewEvery, now),
    reads: pageReads(readRows),
    ...(authors ?? {}),
    ...(editors.length > 0 ? { editors } : {}),
    answered: answered.map((r) => ({ question: r.question, asked: r.asked })),
    agents: agents.map((r) => ({ agent: r.agent, reads: r.reads })),
  });
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
      // Always in Context holds what fits the budget every agent is handed (ai-knowledge.md).
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
