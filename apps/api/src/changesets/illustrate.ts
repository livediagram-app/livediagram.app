// An agent's Illustrate edit (docs/specs/024-agents/illustrate-for-agents.md "The route"; blueprint
// "Data and persistence"): read the tab at its revision, apply the page changes or the article write,
// and write the tab at that revision. Elements that changed (a layout, a deleted page's content, a
// moved page's content) go through the changeset write, so they are recorded, merged into later
// saves and relayed; the pages, mode and writing ride the same batch. Then the room hears what an
// editor's own edit sends. A lost race repeats once from the read.
import {
  tabArticleOps,
  type IllustrateAnswer,
  type IllustrateRefusal,
  type IllustrateRequest,
  type RoomOp,
} from '@livediagram/api-schema';
import { diffToElementOps, type Tab } from '@livediagram/document';
import {
  applyArticleWrite,
  applyPageChanges,
  articleSummaries,
  type PageChangesOutcome,
  pageSummaries,
} from '@livediagram/edit-operations';
import { isTabRevStale, lastChangesetRev, upsertTabAtRev } from '../db';
import { TabTooLargeError } from '../limits';
import { relayIllustrate } from '../room-client';
import type { DocumentDTO, Env } from '../types';
import { readStoredTab } from './stored-tab';
import { SUBMIT_ATTEMPTS, withServerRules } from './submit';
import { writeChangeset, type Author } from './write';

export type IllustrateArgs = {
  env: Env;
  document: DocumentDTO;
  tabId: string;
  request: IllustrateRequest;
  author: Author;
  tokenId: string | null;
};

export type IllustrateResult = {
  status: number;
  body: IllustrateAnswer | ({ error: string } & Omit<IllustrateRefusal, 'code'>);
};

const refused = (status: number, refusal: IllustrateRefusal): IllustrateResult => {
  const { code, ...rest } = refusal;
  return { status, body: { error: code, ...rest } };
};

// The tab fields an editor's `tab-meta` patch carries for pages: absent ones are cleared.
const PAGE_FIELDS = ['pages', 'opensIn', 'pageOrientation'] as const;

/** The ops an editor's own edit would send for the same change, minus the elements (the changeset
 *  carries those). */
export function illustrateRoomOps(before: Tab, after: Tab): RoomOp[] {
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
      patch: patch as Partial<Tab>,
      ...(clear.length ? { clear: clear as (keyof Tab)[] } : {}),
    });
  ops.push(...tabArticleOps(before, after, { agent: true }));
  return ops;
}

export async function submitIllustrate(args: IllustrateArgs): Promise<IllustrateResult> {
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
      console.info('[illustrate-agent] refused', {
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
        console.warn('[illustrate-agent] stale-retry', { ...where, attempt });
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
          console.warn('[illustrate-agent] stale-retry', { ...where, attempt });
          continue;
        }
        throw err;
      }
    }
    const ops = illustrateRoomOps(stored.tab, next);
    // Awaited, bounded per op by ROOM_RELAY_TIMEOUT_MS; a room that misses one is logged and never
    // fails the write.
    await relayIllustrate(env, document.id, ops);
    console.info('[illustrate-agent] applied', {
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
        lines: out.lines,
        pages: pageSummaries(next),
        articles,
        ...(article && wrote ? { article: { ...article, created: wrote.created } } : {}),
        changesetId,
      },
    };
  }
  console.warn('[illustrate-agent] busy', where);
  return {
    status: 409,
    body: { error: 'tab_busy', message: 'The tab kept changing; read it again and resubmit.' },
  };
}

const tooLarge = (): IllustrateResult => ({
  status: 413,
  body: {
    error: 'tab_too_large',
    message:
      'That would make the tab larger than a tab holds: write less, or split it across tabs.',
  },
});
