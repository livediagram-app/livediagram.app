// A page's knowledge over REST (docs/specs/030-knowledgebase/verification.md, links-and-embeds.md "Backlinks",
// ai-knowledge.md "Always in Context"):
//   GET   /api/documents/<id>/pages/<tab>/backlinks   the pages whose writing links here, in tree order
//   GET   /api/documents/<id>/pages/<tab>/health      the fields, the state, the week's reads (Page Health)
//   POST  /api/documents/<id>/pages/<tab>/verify      Verify: now, by the caller, who owns a page with no owner
//   PUT   /api/documents/<id>/pages/<tab>/knowledge   owner, review interval, Always in Context (each optional)
// Reading is every role's; Verify and the fields are an Editor's (verification.md "Share roles").
import { pageTreeRows } from '@liveknowledge/document';
import {
  CONTEXT_BUDGET_TOKENS,
  REVIEW_INTERVALS,
  backlinkRows,
  backlinks,
  countPageReads,
  fitsContextBudget,
  pageReads,
  tokensOfChars,
  verified,
  type KnowledgeFields,
  type PageReadsRow,
} from '@liveknowledge/knowledge';
import type { PageKnowledgePatch } from '@liveknowledge/api-schema';
import { requestGrant } from '../index-service';
import { accountOf } from '../knowledge/knowledge-caller';
import { rowsOf } from '../knowledge/knowledge-db';
import { contextPages } from '../knowledge/knowledge-reads';
import {
  pageKnowledgeOf,
  readPageKnowledge,
  writePageKnowledge,
  type StoredPageKnowledge,
} from '../knowledge/page-knowledge';
import { readStoredPages } from '../document-room/page-tree-store';
import { conflict, forbidden, json, notFound } from '../responses';
import { relayPages } from '../room-client';
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
  const reads = pageReads(await rowsOf<PageReadsRow>(ctx.env, countPageReads(tab, now)));
  return json({ knowledge: pageKnowledgeOf(page, now), reads });
}

// The write, repeated once when the tab moved between the read and the write (an autosave landing), then told to
// every open editor as the `tab-meta` patch its own change would send.
async function saveFields(
  ctx: DocumentRouteContext,
  document: DocumentDTO,
  tab: string,
  change: (page: StoredPageKnowledge) => Promise<KnowledgeFields | Response>,
  opts: { verified?: boolean } = {},
): Promise<Response> {
  const now = Date.now();
  for (let attempt = 0; attempt < 2; attempt++) {
    const page = await readPageKnowledge(ctx.env, document.id, tab);
    if (!page) return notFound();
    const next = await change(page);
    if (next instanceof Response) return next;
    const rev = await writePageKnowledge(ctx.env, page, next, { ...opts, now });
    if (rev === null) continue;
    const after = await readPageKnowledge(ctx.env, document.id, tab);
    if (!after) return notFound();
    console.info('[knowledge] fields', {
      documentId: document.id,
      tabId: tab,
      rev,
      verified: opts.verified === true,
    });
    const patch = Object.keys(after.fields).length > 0 ? { knowledge: after.fields } : {};
    await relayPages(
      ctx.env,
      document.id,
      [
        {
          kind: 'tab-meta',
          tabId: tab,
          patch,
          ...(patch.knowledge ? {} : { clear: ['knowledge'] }),
        },
      ],
      '[knowledge]',
    );
    return json({ knowledge: pageKnowledgeOf(after, now) });
  }
  return conflict('tab_busy');
}

export function handleVerify(
  ctx: DocumentRouteContext,
  document: DocumentDTO,
  tab: string,
): Promise<Response> | Response {
  // Verify says who vouches for the page: an account, never a guest's or a link visitor's id.
  const person = accountOf(ctx);
  if (!person) return forbidden();
  return saveFields(ctx, document, tab, async (page) => verified(page.fields, person, Date.now()), {
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
  if (person === accountOf(ctx) || person === document.ownerId) return true;
  const outcome = await requestGrant(
    ctx.env,
    { kind: 'delegate', personId: person, teams: [] },
    document.id,
    null,
  );
  return outcome.ok;
}

export async function handleKnowledgePatch(
  ctx: DocumentRouteContext,
  document: DocumentDTO,
  tab: string,
): Promise<Response> {
  const body = (await ctx.request.json().catch(() => null)) as PageKnowledgePatch | null;
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return invalid('invalid_body', 'Send owner, reviewEvery or context.');
  const { owner, reviewEvery, context } = body;
  if (
    owner !== undefined &&
    owner !== null &&
    (typeof owner !== 'string' || !owner || owner.length > 128)
  )
    return invalid('invalid_owner', 'owner is an account id, or null for none.');
  if (reviewEvery !== undefined && !REVIEW_INTERVALS.includes(reviewEvery))
    return invalid('invalid_review_every', 'reviewEvery is 30, 90, 180, 365 or "never".');
  if (context !== undefined && typeof context !== 'boolean')
    return invalid('invalid_context', 'context is true or false.');
  if (owner === undefined && reviewEvery === undefined && context === undefined)
    return invalid('invalid_body', 'Send owner, reviewEvery or context.');
  if (typeof owner === 'string' && !(await hasAccess(ctx, document, owner)))
    return invalid('owner_no_access', 'The owner must be someone who can open this knowledgebase.');
  return saveFields(ctx, document, tab, async (page) => {
    const next: KnowledgeFields = { ...page.fields };
    if (owner === null) delete next.owner;
    else if (owner !== undefined) next.owner = owner;
    if (reviewEvery !== undefined) next.reviewEvery = reviewEvery;
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
