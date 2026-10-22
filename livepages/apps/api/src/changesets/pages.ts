// An agent's Pages edit (docs/specs/024-agents/pages-for-agents.md "The route"; blueprint
// "Data and persistence"): read the tab at its revision, apply the page changes or the article write,
// and write the tab at that revision. Elements that changed (a layout, a deleted page's content, a
// moved page's content) go through the changeset write, so they are recorded, merged into later
// saves and relayed; the pages, mode and writing ride the same batch. Then the room hears what an
// editor's own edit sends. A lost race repeats once from the read.
import {
  tabArticleOps,
  type PagesAnswer,
  type PagesRefusal,
  type PagesRequest,
  type RoomOp,
} from '@livepages/api-schema';
import { diffToElementOps, plural, type Tab } from '@livepages/document';
import {
  applyArticleWrite,
  applyPageChanges,
  articleSummaries,
  type PageChangesOutcome,
  pageSummaries,
} from '@livepages/edit-operations';
import { isTabRevStale, lastChangesetRev, upsertTabAtRev } from '../db';
import { TabTooLargeError } from '../limits';
import { relayPages } from '../room-client';
import type { DocumentDTO, Env } from '../types';
import { readStoredTab } from './stored-tab';
import { SUBMIT_ATTEMPTS, withServerRules } from './submit';
import { writeChangeset, type Author } from './write';

type PagesArgs = {
  env: Env;
  document: DocumentDTO;
  tabId: string;
  request: PagesRequest;
  author: Author;
  tokenId: string | null;
};

type PagesResult = {
  status: number;
  body: PagesAnswer | ({ error: string } & Omit<PagesRefusal, 'code'>);
};

const refused = (status: number, refusal: PagesRefusal): PagesResult => {
  const { code, ...rest } = refusal;
  return { status, body: { error: code, ...rest } };
};

// The tab fields an editor's `tab-meta` patch carries for pages: absent ones are cleared.
const PAGE_FIELDS = ['pages', 'opensIn', 'pageOrientation'] as const;

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
  if (Object.keys(patch).length || clear.length)
    ops.push({
      kind: 'tab-meta',
      tabId: after.id,
      patch: patch,
      ...(clear.length ? { clear: clear } : {}),
    });
  ops.push(...tabArticleOps(before, after, { agent: true }));
  return ops;
}

export async function submitPages(args: PagesArgs): Promise<PagesResult> {
  const { env, document, tabId, request } = args;
  const where = { documentId: document.id, tabId };
  for (let attempt = 1; attempt <= SUBMIT_ATTEMPTS; attempt += 1) {
    const [stored, prevRev] = await Promise.all([
      readStoredTab(env, document.id, tabId),
      lastChangesetRev(env, tabId),
    ]);
    if (!stored) return { status: 404, body: { error: 'not_found', message: 'No such tab.' } };
    // The page changes, or the write and which article it made or wrote.
    let out: PageChangesOutcome;
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
    const ops = pagesRoomOps(stored.tab, next);
    // Awaited, bounded per op by ROOM_RELAY_TIMEOUT_MS; a room that misses one is logged and never
    // fails the write.
    await relayPages(env, document.id, ops);
    console.info('[pages-agent] applied', {
      ...where,
      kind: 'pages' in request ? 'pages' : 'article',
      changes: 'pages' in request ? request.pages.length : 1,
      rev,
      switched: out.switched,
    });
    const articles = articleSummaries(next);
    const article = wrote ? articles.find((a) => a.flow === wrote.flow) : undefined;
    return {
      status: 200,
      body: {
        tab: { id: tabId, rev },
        switched: out.switched,
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
