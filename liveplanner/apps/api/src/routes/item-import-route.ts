// A whole import (docs/specs/026-plan/tracker-import.md "The import", blueprint tracker-import.md "A whole import"):
// `POST /api/projects/:id/items/import`, one part at a time. Every part but the last is read, checked and held aside
// (db/item-imports.ts); the last lands every held card and its own, with their comment threads, in one batch of the
// plan's own SQLite, so an import is never written in part. An Editor's, on the whole plan, as `/items/bulk` is.

import type { ItemsImportStaged, ItemsResponse } from '@liveplanner/api-schema';
import {
  ITEMS_MAX,
  ITEM_BULK_MAX,
  ITEM_IMPORT_ID,
  ITEM_WRITE_RETRIES,
  type Item,
} from '@liveplanner/items';
import { threadForRoom, withoutLegacyThread, type CardThread } from '@liveplanner/project';
import { insertLinkStatement, insertThreadStatement } from '../db/card-threads';
import { appendItemHistory } from '../db/item-history';
import {
  ITEM_IMPORT_HOLD_MS,
  clearImportStatement,
  heldParts,
  heldReads,
  holdPartStatements,
  sweepHeldImports,
} from '../db/item-imports';
import { bumpRevStatement, getItemStoreHead, itemRowOf, revOf } from '../db/items';
import { insertItemRowsStatements } from '../plan-room/plan-content';
import { badRequest, conflict, forbidden, json } from '../responses';
import { relayItems, relayThreads } from '../room-client';
import { readBody, type PlanRouteContext } from './context';
import { historyTagOf } from './item-history-route';
import {
  blockersRefused,
  forCaller,
  itemBusy,
  itemCaller,
  itemRetryPause,
  rejected,
  writer,
  type ItemCaller,
} from './item-route-kit';
import { writeSource } from './automation-source';
import { buildCreates, itemsFull, readBulkCreates, type ReadCreate } from './item-routes';

type ImportHead = { importId: string; part: number; parts: number };

// The part's place in its import, or why it is not one.
function readImportHead(body: Record<string, unknown>): ImportHead | string {
  const { importId, part, parts } = body;
  if (typeof importId !== 'string' || !ITEM_IMPORT_ID.test(importId))
    return 'importId must be 8 to 64 letters, digits, - or _';
  if (typeof parts !== 'number' || !Number.isInteger(parts) || parts < 1 || parts > ITEMS_MAX)
    return `parts must be 1 to ${ITEMS_MAX}`;
  if (typeof part !== 'number' || !Number.isInteger(part) || part < 0 || part >= parts)
    return 'part must be 0 to parts - 1';
  return { importId, part, parts };
}

// An import's threads are new threads of this plan (withImportedThreads); a card's old single thread (a client from
// before threads, home '~here') becomes one. A thread of another plan is a restore's, never an import's.
const homedHere = (reads: readonly ReadCreate[], projectId: string) =>
  reads.every((r) =>
    (r.restoredThreads ?? []).every((t) => t.home === projectId || t.home === '~here'),
  );

// The refusal, with the import's held parts cleared: it can no longer land.
async function refuse(
  ctx: PlanRouteContext,
  projectId: string,
  importId: string,
  answer: Response,
): Promise<Response> {
  await clearImportStatement(ctx.env, projectId, importId).run();
  console.info('[items] import.refused', { projectId, status: answer.status });
  return answer;
}

export async function importItems(ctx: PlanRouteContext, projectId: string): Promise<Response> {
  const caller = await itemCaller(ctx, projectId, 'edit');
  if (caller instanceof Response) return caller;
  // A whole-plan write, as /items/bulk.
  if (caller.scope) return forbidden();
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const head = readImportHead(body);
  if (typeof head === 'string') return badRequest(head);
  const now = Date.now();
  // Parts an import left waiting go first, whichever import they were for.
  const swept = await sweepHeldImports(ctx.env, projectId, now - ITEM_IMPORT_HOLD_MS);
  if (swept > 0) console.info('[items] import.swept', { projectId, cards: swept });
  const read = readBulkCreates(caller, body.items);
  if (read instanceof Response) return refuse(ctx, projectId, head.importId, read);
  if (!homedHere(read.reads, projectId))
    return refuse(ctx, projectId, head.importId, rejected('field_value_invalid'));
  if (head.part < head.parts - 1) return hold(ctx, projectId, head, read.reads, now);
  return land(ctx, caller, head, read.reads);
}

// A part before the last: held aside while the plan has room for it and the parts already held.
async function hold(
  ctx: PlanRouteContext,
  projectId: string,
  head: ImportHead,
  reads: readonly ReadCreate[],
  now: number,
): Promise<Response> {
  const held = (await heldParts(ctx.env, projectId, head.importId))
    .filter((p) => p.part !== head.part)
    .reduce((n, p) => n + p.cards, 0);
  const { count } = await getItemStoreHead(ctx.env, projectId);
  if (count + held + reads.length > ITEMS_MAX)
    return refuse(ctx, projectId, head.importId, itemsFull());
  await ctx.env.PLAN_DB.batch(
    holdPartStatements(ctx.env, projectId, head.importId, head.part, reads, now),
  );
  const answer: ItemsImportStaged = { staged: held + reads.length };
  return json(answer, { status: 202 });
}

// Each made card's threads as rows of this plan, on that card alone (as cardBackOnThreads puts a thread it does not
// hold back): the thread and its link, per thread.
function threadsOf(projectId: string, made: readonly Item[], reads: readonly ReadCreate[]) {
  return made.map((item, i) =>
    (reads[i]?.restoredThreads ?? []).map((t): CardThread => ({
      ...t,
      ...(t.home === '~here' ? { id: `c-${item.id}` } : {}),
      home: projectId,
      cards: [{ projectId, itemId: item.id, key: item.key }],
      rev: t.rev + 1,
    })),
  );
}

// The last part: every part held, then the whole import in one batch, or nothing.
async function land(
  ctx: PlanRouteContext,
  caller: ItemCaller,
  head: ImportHead,
  last: readonly ReadCreate[],
): Promise<Response> {
  const { projectId } = caller;
  const { importId } = head;
  const parts = await heldParts(ctx.env, projectId, importId);
  if (parts.length !== head.parts - 1 || parts.some((p, i) => p.part !== i))
    return refuse(ctx, projectId, importId, conflict('import_incomplete'));
  const reads = [...(await heldReads<ReadCreate>(ctx.env, projectId, importId)), ...last];
  const creates = reads.map(({ restoredThreads: _threads, ...c }) => c);
  // Blocked By loops, checked once over every card of the import (docs/specs/026-plan/item-types.md "Blocked By").
  const blocked = await blockersRefused(
    ctx,
    caller,
    creates.map((c) => ({ next: { ...c, id: c.id ?? '' } })),
  );
  if (blocked) return refuse(ctx, projectId, importId, blocked);
  const by = await writer(ctx, caller.owner);
  const db = ctx.env.PLAN_DB;
  for (let attempt = 1; attempt <= ITEM_WRITE_RETRIES; attempt += 1) {
    const made = await buildCreates(ctx, projectId, creates, by);
    if (made instanceof Response) return refuse(ctx, projectId, importId, made);
    const threads = threadsOf(projectId, made, reads);
    // The held parts go, then each relayed part of the cards (a store rev raise and its rows), then the threads.
    const stmts: D1PreparedStatement[] = [clearImportStatement(ctx.env, projectId, importId)];
    const revAt: number[] = [];
    const chunks: Item[][] = [];
    for (let i = 0; i < made.length; i += ITEM_BULK_MAX) {
      const chunk = made.slice(i, i + ITEM_BULK_MAX);
      chunks.push(chunk);
      revAt.push(stmts.length);
      stmts.push(
        bumpRevStatement(ctx.env, projectId, Math.max(...chunk.map((m) => m.key)) + 1),
        ...insertItemRowsStatements(ctx.env, projectId, chunk.map(itemRowOf)),
      );
    }
    for (const t of threads.flat())
      stmts.push(
        insertThreadStatement(ctx.env, t),
        insertLinkStatement(ctx.env, projectId, {
          itemId: t.cards[0]!.itemId,
          threadId: t.id,
          home: projectId,
          openComments: t.comments.length,
        }),
      );
    let results: D1Result[];
    try {
      results = await db.batch(stmts);
    } catch (err) {
      // A key or id taken by a write that raced this one: read again and retry. The parts stay held.
      console.info('[items] import.retry', { projectId, attempt, error: String(err) });
      if (attempt < ITEM_WRITE_RETRIES) await itemRetryPause(attempt);
      continue;
    }
    const revs = revAt.map((at) => revOf(results[at]));
    relayLanded(ctx, projectId, chunks, threads, revs);
    const putBack = creates.some((c) => c.key !== undefined || c.votes !== undefined);
    await appendItemHistory(
      ctx.env,
      projectId,
      made.map((after) => ({ before: null, after })),
      historyTagOf(ctx, putBack),
      writeSource(ctx, projectId),
    );
    console.info('[items] import.landed', { projectId, cards: made.length, parts: head.parts });
    const answer: ItemsResponse = { items: forCaller(caller, made), rev: revs.at(-1)! };
    return json(answer, { status: 201 });
  }
  return itemBusy();
}

// The landed cards reach the room as /items/bulk writes would have: an items op per ITEM_BULK_MAX cards, each at its
// own rev and in order, and a threads op for the same cards.
function relayLanded(
  ctx: PlanRouteContext,
  projectId: string,
  chunks: readonly Item[][],
  threads: readonly CardThread[][],
  revs: readonly number[],
): void {
  ctx.waitUntil?.(
    (async () => {
      let at = 0;
      for (const [i, chunk] of chunks.entries()) {
        await relayItems(ctx.env, projectId, {
          kind: 'items',
          upserts: chunk.map(withoutLegacyThread),
          removed: [],
          rev: revs[i]!,
        });
        const upserts = threads
          .slice(at, at + chunk.length)
          .flat()
          .map(threadForRoom);
        at += chunk.length;
        if (upserts.length)
          await relayThreads(ctx.env, projectId, { kind: 'threads', upserts, removed: [] });
      }
    })(),
  );
}
