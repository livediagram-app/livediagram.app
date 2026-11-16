// An agent's Pages edit (docs/specs/024-agents/pages-for-agents.md "The route"; blueprint
// "Data and persistence"): read the tab at its revision, apply the page changes or the article write,
// and write the tab at that revision. Elements that changed (a layout, a deleted page's content, a
// moved page's content) go through the changeset write, so they are recorded, merged into later
// saves and relayed; the pages, mode and writing ride the same batch. Then the room hears what an
// editor's own edit sends. A lost race repeats once from the read.
import {
  parseStoredReview,
  tabArticleOps,
  type HeldParagraph,
  type PagesAnswer,
  type PagesRefusal,
  type PagesRequest,
  type RoomOp,
} from '@livedocuments/api-schema';
import {
  articleNoteIds,
  articlesOf,
  articleTitleOf,
  diffToElementOps,
  isArticleHex,
  pageStepsOf,
  plural,
  withArticleFlow,
  type Tab,
} from '@livedocuments/document';
import {
  applyArticleWrite,
  applyPageChanges,
  articleSummaries,
  suggestArticleWrite,
  suggestedWriteLines,
  type PageChangesOutcome,
  pageSummaries,
} from '@livedocuments/edit-operations';
import { agentVersionStatement, isTabRevStale, lastChangesetRev, upsertTabAtRev } from '../db';
import { TabTooLargeError } from '../limits';
import { readRoomHolds, relayPages } from '../room-client';
import type { DocumentDTO, DocumentEnv } from '../types';
import { heldArticleTargets, heldMessage } from './held-paragraphs';
import { readStoredTab } from './stored-tab';
import { SUBMIT_ATTEMPTS, withServerRules } from './submit';
import { writeChangeset, type Author } from './write';

type PagesArgs = {
  env: DocumentEnv;
  document: DocumentDTO;
  tabId: string;
  request: PagesRequest;
  author: Author;
  tokenId: string | null;
};

type PagesResult = {
  status: number;
  body:
    | PagesAnswer
    | ({ error: string } & Omit<PagesRefusal, 'code'>)
    | { error: 'paragraphs_held'; message: string; held: HeldParagraph[] };
};

const refused = (status: number, refusal: PagesRefusal): PagesResult => {
  const { code, ...rest } = refusal;
  return { status, body: { error: code, ...rest } };
};

// The tab fields an editor's `tab-meta` patch carries for pages: absent ones are cleared.
const PAGE_FIELDS = ['pages', 'pageOrientation'] as const;

// An assistant's write as suggestions (docs/specs/024-agents/pages-for-agents.md "Suggestions"): its name, how many
// it made and its change id, for the editor's toast.
type Suggested = { n: string; count: number; g: string };

/** The ops an editor's own edit would send for the same change, minus the elements (the changeset
 *  carries those). */
export function pagesRoomOps(before: Tab, after: Tab, suggested?: Suggested): RoomOp[] {
  const ops: RoomOp[] = [];
  const patch: Record<string, unknown> = {};
  const clear: string[] = [];
  for (const key of PAGE_FIELDS) {
    if (before[key] === after[key]) continue;
    if (after[key] === undefined) clear.push(key);
    else patch[key] = after[key];
  }
  // The pages' steps too, so an editor applies the change over its own pages by id and keeps a page it added
  // meanwhile (docs/specs/012-collaboration/collab-race-hardening.md "Pages").
  const pageSteps = 'pages' in patch ? pageStepsOf(before, after) : [];
  if (Object.keys(patch).length || clear.length)
    ops.push({
      kind: 'tab-meta',
      tabId: after.id,
      patch: patch,
      ...(clear.length ? { clear: clear } : {}),
      ...(pageSteps.length ? { pageSteps } : {}),
    });
  ops.push(...tabArticleOps(before, after, { grow: true, ...(suggested ? { suggested } : {}) }));
  return ops;
}

// Whether the document's Assistants Suggest switch is on (docs/specs/007-editor/suggestions.md "Suggest Only").
async function assistantsSuggest(env: DocumentEnv): Promise<boolean> {
  const row = await env.DOCUMENT_DB.prepare('SELECT review FROM document LIMIT 1').first<{
    review: string | null;
  }>();
  return parseStoredReview(row?.review ?? null).agents;
}

/** An assistant's article write made suggestions on the stored article: the written article replaced by the stored
 *  one with the changes suggested, margin notes on text that still stands keeping their markers, and the answer's
 *  lines saying what became of it. A new article has nothing to suggest against: it is written as it is. */
export function suggestedWrite(
  stored: Tab,
  written: { tab: Tab; flow: string; created: boolean; lines: string[] },
  author: Author,
  tokenId: string,
  g: string,
  now = Date.now(),
): { tab: Tab; lines: string[]; suggested: Suggested | null } {
  const before = articlesOf(stored)[written.flow];
  if (written.created || !before) return { ...written, suggested: null };
  const after = articlesOf(written.tab)[written.flow]!;
  const n = author.name.trim().slice(0, 80) || 'Assistant';
  const write = suggestArticleWrite(before, after, {
    by: `agent:${tokenId}`.slice(0, 64),
    n,
    ...(isArticleHex(author.color) ? { c: author.color } : {}),
    at: now,
    ai: true,
    g,
  });
  let tab = withArticleFlow(written.tab, written.flow, write.flow);
  const notes = articleNoteIds({ [written.flow]: write.flow });
  const have = new Set(tab.elements.map((e) => e.id));
  const back = stored.elements.filter(
    (e) => e.type === 'article-note' && notes.has(e.id) && !have.has(e.id),
  );
  if (back.length) tab = { ...tab, elements: [...tab.elements, ...back] };
  return {
    tab,
    lines: suggestedWriteLines(write, articleTitleOf(write.flow)),
    suggested: write.suggested ? { n, count: write.suggested, g } : null,
  };
}

export async function submitPages(args: PagesArgs): Promise<PagesResult> {
  const { env, document, tabId, request } = args;
  const where = { documentId: document.id, tabId };
  for (let attempt = 1; attempt <= SUBMIT_ATTEMPTS; attempt += 1) {
    // An agent's article write reads the room's paragraph holds beside the tab (spec "Held paragraphs"); page
    // changes never touch the writing, and a person's own write is never held.
    const agentWrite = args.tokenId && 'article' in request;
    const [stored, prevRev, holds, agentsSuggest] = await Promise.all([
      readStoredTab(env, document.id, tabId),
      lastChangesetRev(env, tabId),
      agentWrite ? readRoomHolds(env, document.id, tabId) : null,
      agentWrite ? assistantsSuggest(env) : false,
    ]);
    if (!stored) return { status: 404, body: { error: 'not_found', message: 'No such tab.' } };
    // The page changes, or the write and which article it made or wrote.
    let out: PageChangesOutcome;
    let wrote: { flow: string; created: boolean } | null = null;
    let suggested: Suggested | null = null;
    if ('pages' in request) out = applyPageChanges(stored.tab, request.pages);
    else {
      const w = applyArticleWrite(stored.tab, request.article);
      out = w;
      if (!('refusal' in w)) {
        wrote = { flow: w.flow, created: w.created };
        // An assistant's write as suggestions: asked for, or always while Assistants Suggest is on.
        if (args.tokenId && (request.article.as === 'suggestions' || agentsSuggest)) {
          const g = `cs-${crypto.randomUUID().slice(0, 8)}`;
          const s = suggestedWrite(stored.tab, w, args.author, args.tokenId, g);
          out = { tab: s.tab, lines: s.lines };
          suggested = s.suggested;
        }
      }
    }
    if ('refusal' in out) {
      console.info('[pages-agent] refused', {
        ...where,
        code: out.refusal.code,
        change: out.refusal.change ?? null,
      });
      return refused(400, out.refusal);
    }
    const next = withServerRules(out.tab, stored, args.author);
    const ops = pagesRoomOps(stored.tab, next, suggested ?? undefined);
    const held = heldArticleTargets(ops, holds);
    if (held.length > 0) {
      console.info('[pages-agent] held', { ...where, held: held.length });
      return {
        status: 409,
        body: { error: 'paragraphs_held', message: heldMessage(stored.tab, held), held },
      };
    }
    const elementsChanged = diffToElementOps(stored.tab.elements, next.elements).length > 0;
    let rev: number;
    let changesetId: string | null = null;
    if (elementsChanged) {
      const written = await writeChangeset(env, {
        documentId: document.id,
        tabId,
        stored,
        next,
        orderIndex: stored.orderIndex,
        author: args.author,
        tokenId: args.tokenId,
        summary: null,
        baseRev: null,
        rebasedOver: 0,
        prevRev,
        results: [],
        textFor: () => out.lines.join('\n'),
        revertOf: null,
      });
      if (written.kind === 'stale') {
        console.warn('[pages-agent] stale-retry', { ...where, attempt });
        continue;
      }
      if (written.kind === 'too_large') return tooLarge();
      // 'unchanged' cannot happen with element changes; read the stored revision if it ever does.
      rev = written.kind === 'written' ? written.written.rev : stored.rev;
      changesetId = written.kind === 'written' ? written.written.id : null;
    } else {
      try {
        // An agent's page change starts its burst's version too (docs/specs/006-document/version-history.md), kept
        // first as its own statement: the page write is its own batch.
        if (args.tokenId) {
          await agentVersionStatement(env, {
            tabId,
            tokenId: args.tokenId,
            author: args.author,
            now: Date.now(),
          }).run();
        }
        rev = await upsertTabAtRev(env, document.id, next, stored.orderIndex, stored.rev);
      } catch (err) {
        if (err instanceof TabTooLargeError) return tooLarge();
        if (isTabRevStale(err)) {
          console.warn('[pages-agent] stale-retry', { ...where, attempt });
          continue;
        }
        throw err;
      }
    }
    // Awaited, bounded per op by ROOM_RELAY_TIMEOUT_MS; a room that misses one is logged and never
    // fails the write.
    await relayPages(env, document.id, ops);
    console.info('[pages-agent] applied', {
      ...where,
      kind: 'pages' in request ? 'pages' : suggested ? 'suggestions' : 'article',
      changes: 'pages' in request ? request.pages.length : 1,
      rev,
    });
    const articles = articleSummaries(next);
    const article = wrote ? articles.find((a) => a.flow === wrote.flow) : undefined;
    return {
      status: 200,
      body: {
        tab: { id: tabId, rev },
        lines: article
          ? [
              ...out.lines,
              `It takes about ${plural(article.estimatedPages, 'page', 'pages')} once laid out (estimated: the editor adds pages to hold the writing and drops any it leaves empty).`,
            ]
          : out.lines,
        pages: pageSummaries(next),
        articles,
        ...(article && wrote ? { article: { ...article, created: wrote.created } } : {}),
        changesetId,
      },
    };
  }
  console.warn('[pages-agent] busy', where);
  return {
    status: 409,
    body: { error: 'tab_busy', message: 'The tab kept changing; read it again and resubmit.' },
  };
}

const tooLarge = (): PagesResult => ({
  status: 413,
  body: {
    error: 'tab_too_large',
    message:
      'That would make the tab larger than a tab holds: write less, or split it across tabs.',
  },
});
