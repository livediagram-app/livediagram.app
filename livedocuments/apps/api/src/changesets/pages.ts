// An agent's Pages edit (docs/specs/024-agents/pages-for-agents.md "The route"; blueprint
// "Data and persistence"): read the tab at its revision, apply the page changes or the article write,
// and write the tab at that revision. Elements that changed (a layout, a deleted page's content, a
// moved page's content) go through the changeset write, so they are recorded, merged into later
// saves and relayed; the pages, mode and writing ride the same batch. Then the room hears what an
// editor's own edit sends. A lost race repeats once from the read.
import {
  tabArticleOps,
  type HeldParagraph,
  type PagesAnswer,
  type PagesRefusal,
  type PagesRequest,
  type RoomOp,
} from '@livedocuments/api-schema';
import { diffToElementOps, pageStepsOf, plural, type Tab } from '@livedocuments/document';
import {
  applyArticleWrite,
  applyPageChanges,
  articleSummaries,
  type PageChangesOutcome,
  pageSummaries,
  pagesTextsLeftOut,
} from '@livedocuments/edit-operations';
import { agentVersionStatement, isTabRevStale, lastChangesetRev, upsertTabAtRev } from '../db';
import { TabTooLargeError } from '../limits';
import { readRoomHolds, relayPages } from '../room-client';
import type { DocumentDTO, DocumentEnv } from '../types';
import { heldArticleTargets, heldMessage } from './held-paragraphs';
import { readStoredTab } from './stored-tab';
import { SUBMIT_ATTEMPTS, withServerRules } from './submit';
import { queueAgentChanged } from '../document-room/automations/version-events';
import { writeChangeset, type Author } from './write';

type PagesArgs = {
  env: DocumentEnv;
  document: DocumentDTO;
  tabId: string;
  request: PagesRequest;
  author: Author;
  tokenId: string | null;
  // The token's name, for a rule's Who Did It (docs/specs/013-workspace/automations.md "Agent Made Changes").
  tokenName?: string | null;
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

/** The ops an editor's own edit would send for the same change, minus the elements (the changeset
 *  carries those). */
export function pagesRoomOps(before: Tab, after: Tab): RoomOp[] {
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
  ops.push(...tabArticleOps(before, after, { grow: true }));
  return ops;
}

export async function submitPages(args: PagesArgs): Promise<PagesResult> {
  const { env, document, tabId, request } = args;
  const where = { documentId: document.id, tabId };
  for (let attempt = 1; attempt <= SUBMIT_ATTEMPTS; attempt += 1) {
    // An agent's article write reads the room's paragraph holds beside the tab (spec "Held paragraphs"); page
    // changes never touch the writing, and a person's own write is never held.
    const agentWrite = args.tokenId && 'article' in request;
    const [stored, prevRev, holds] = await Promise.all([
      readStoredTab(env, document.id, tabId),
      lastChangesetRev(env, tabId),
      agentWrite ? readRoomHolds(env, document.id, tabId) : null,
    ]);
    if (!stored) return { status: 404, body: { error: 'not_found', message: 'No such tab.' } };
    // The page changes, or the write and which article it made or wrote.
    let out: PageChangesOutcome | ReturnType<typeof applyArticleWrite>;
    let wrote: { flow: string; created: boolean } | null = null;
    if ('pages' in request) out = applyPageChanges(stored.tab, request.pages);
    else {
      const w = applyArticleWrite(stored.tab, request.article);
      out = w;
      if (!('refusal' in w)) wrote = { flow: w.flow, created: w.created };
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
    const ops = pagesRoomOps(stored.tab, next);
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
        tokenName: args.tokenName ?? null,
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
        // Agent Made Changes for a write no changeset records (writeChangeset queues its own).
        if (args.tokenId)
          queueAgentChanged(env, {
            key: `pages:${tabId}:${rev}`,
            tab: tabId,
            author: args.author,
            tokenName: args.tokenName ?? null,
          });
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
      kind: 'pages' in request ? 'pages' : 'article',
      changes: 'pages' in request ? request.pages.length : 1,
      rev,
    });
    const articles = articleSummaries(next);
    const article = wrote ? articles.find((a) => a.flow === wrote.flow) : undefined;
    // The texts of each page the changes laid out (spec "A laid-out page's texts"), within their budget.
    const laid = 'laid' in out ? out.laid : undefined;
    const pages = pageSummaries(next, laid);
    const leftOut = pagesTextsLeftOut(pages, laid);
    return {
      status: 200,
      body: {
        tab: { id: tabId, rev },
        lines: article
          ? [
              ...out.lines,
              `It takes about ${plural(article.estimatedPages, 'page', 'pages')} once laid out (estimated: the editor adds pages to hold the writing and drops any it leaves empty).`,
            ]
          : leftOut
            ? [...out.lines, leftOut]
            : out.lines,
        pages,
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
