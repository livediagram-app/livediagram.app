// An AI assistant whose token was revoked leaves the plan (docs/specs/026-plan/items.md "When its token is revoked";
// blueprint item-store.md "A revoked assistant", Work Tracker 1294): liveworkspace tells the plan through the index
// (POST /api/internal/people/:id/assistant-revoked), and the plan's Durable Object runs this. The tool goes from the
// plan's remembered assistants, and each card it holds goes back to the person it worked for, by Access Revoked, one
// rev-guarded write a batch, relayed and noted in the card's history. A card a person re-assigned meanwhile no longer
// holds it and is left alone. Running it again changes nothing.

import {
  ITEM_WRITE_RETRIES,
  REVOKED_PERSON,
  applyPatch,
  assistantPersonOf,
  itemAssistantFor,
  itemAssistantOf,
  itemPersonId,
  type Item,
} from '@liveplanner/items';
import { appendItemHistory } from '../db/item-history';
import { readItems, updateItemsAtRev } from '../db/items';
import type { PlanEnv } from '../types';

// Cards one write hands back at most.
export const REVOKE_WRITE_BATCH = 100;

export type RevokeOutcome = { forgotten: boolean; cards: number };

// The ids of the plan's cards whose Assignee is this assistant: one pass over the plan's own rows, parsing only those
// whose text holds the id.
async function heldBy(env: PlanEnv, planId: string, id: string): Promise<string[]> {
  const { results } = await env.PLAN_DB.prepare(
    `SELECT id FROM items WHERE plan_id = ?1 AND instr(fields, ?2) > 0
        AND CASE WHEN json_valid(fields) THEN fields ->> '$.assignee.id' END = ?2`,
  )
    .bind(planId, id)
    .all<{ id: string }>();
  return results.map((r) => r.id);
}

// Hands back what one batch of cards still holds of the assistant. Answers the ids that moved on since they were read.
async function handBackBatch(
  env: PlanEnv,
  planId: string,
  id: string,
  ids: string[],
  relay: (items: Item[], rev: number) => void,
  now: number,
): Promise<{ handed: number; moved: string[] }> {
  const writes: { before: Item; next: Item }[] = [];
  for (const card of await readItems(env, planId, ids)) {
    const held = itemAssistantOf(card);
    if (held?.id !== id) continue;
    writes.push({
      before: card,
      next: applyPatch(
        card,
        { set: { assignee: assistantPersonOf(held) } },
        { now, by: REVOKED_PERSON },
      ),
    });
  }
  if (writes.length === 0) return { handed: 0, moved: [] };
  const { rev, landed } = await updateItemsAtRev(
    env,
    planId,
    writes.map((w) => ({ next: w.next, expectedRev: w.before.rev })),
  );
  const done = writes.filter((w) => landed.has(w.next.id));
  const moved = writes.filter((w) => !landed.has(w.next.id)).map((w) => w.next.id);
  if (done.length > 0) {
    relay(
      done.map((w) => w.next),
      rev,
    );
    await appendItemHistory(
      env,
      planId,
      done.map((w) => ({ before: w.before, after: w.next })),
    );
  }
  return { handed: done.length, moved };
}

export async function handBackRevoked(
  env: PlanEnv,
  planId: string,
  personId: string,
  client: string,
  relay: (items: Item[], rev: number) => void,
  now = Date.now(),
): Promise<RevokeOutcome> {
  // The id the plan knows the tool by; a name the store never takes was never an assistant here.
  const probe = itemAssistantFor(
    { id: await itemPersonId(personId), name: '', color: '#000000' },
    client,
  );
  if (!probe) return { forgotten: false, cards: 0 };
  const forgot = await env.PLAN_DB.prepare('DELETE FROM known_assistants WHERE id = ?')
    .bind(probe.id)
    .run();
  let pending = await heldBy(env, planId, probe.id);
  let cards = 0;
  let retries = 0;
  for (let attempt = 0; pending.length > 0 && attempt < ITEM_WRITE_RETRIES; attempt++) {
    if (attempt > 0) retries += pending.length;
    const moved: string[] = [];
    for (let i = 0; i < pending.length; i += REVOKE_WRITE_BATCH) {
      const batch = await handBackBatch(
        env,
        planId,
        probe.id,
        pending.slice(i, i + REVOKE_WRITE_BATCH),
        relay,
        now,
      );
      cards += batch.handed;
      moved.push(...batch.moved);
    }
    pending = moved;
  }
  const forgotten = (forgot.meta.changes ?? 0) > 0;
  if (forgotten || cards > 0 || pending.length > 0) {
    console.info('[items] assistant.revoked', { cards, retries, left: pending.length });
  }
  // Cards that kept moving under every retry: the index asks again later, and what landed stays landed.
  if (pending.length > 0)
    throw new Error(`assistant hand-back: ${pending.length} cards kept moving`);
  return { forgotten, cards };
}
