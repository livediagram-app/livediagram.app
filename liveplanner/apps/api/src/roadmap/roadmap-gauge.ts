// The owner's published roadmaps as the subscription service counts them (docs/specs/026-plan/public-roadmap.md
// "Tiers"; blueprint public-roadmap.md "Tiers (Pro)"): its `publicRoadmaps` gauge holds one key per roadmap,
// `<plan id>:<board id>`. Publish claims one first and is refused at the owner's tier's limit; Unpublish, a board or
// tab gone, the plan's purge and a move to another owner give it back.
//
// A roadmap answers the public only while it HOLDS a counted place: each row keeps a `counted` mark (roadmap-store.ts),
// set when the count takes it and cleared when its place is given back or refused. So a board deleted, another
// published in its place and the delete undone never leaves two answering on a limit of one. A row never counted
// (published before Pro, or while the service was out of reach) answers until its first count, which takes the
// plan's rows oldest first: within the limit none is ever taken down, and past it the oldest keep their places.
// A guest's plan is counted here alone, against Free's limit (019 "A guest's item"). With Pro off nothing here makes
// a call and no mark is read.
import { refusedByService, type GaugeResult, type OwnerScope } from '@liveworkspace/subscription';
import type { Sql } from '../plan-room/automations/automation-store';
import { tierOn, type PlanTier } from '../plan-room/tier/plan-tier';
import type { PlanEnv } from '../types';
import { planTypesOf, roadmapBoardsOf } from './roadmap-boards';
import { roadmapsOf, setRoadmapCounted } from './roadmap-store';

const GAUGE = 'publicRoadmaps';

export const roadmapKey = (planId: string, boardId: string): string => `${planId}:${boardId}`;

/** A roadmap row as the count reads it. */
export type CountedRow = { boardId: string; counted: boolean | null };

/** Whether a roadmap answers the public: always with Pro off; with it on, unless its place was given back or refused. */
export function roadmapServes(
  tier: Pick<PlanTier, 'on'> | null | undefined,
  row: Pick<CountedRow, 'counted'>,
): boolean {
  return !tier?.on || row.counted !== false;
}

/**
 * One more roadmap for the plan's owner, asked before the board is published. Null where nothing is counted. `held`:
 * how many of the plan's other roadmaps hold a place now (a guest's plan is counted by that alone).
 */
export function claimRoadmap(
  tier: PlanTier,
  planId: string,
  boardId: string,
  held = 0,
): Promise<GaugeResult | null> {
  return tier.claim(GAUGE, roadmapKey(planId, boardId), held);
}

/** The board's roadmap given back: the plan's owner's, or `of`'s (the owner the plan has just left). */
export function releaseRoadmap(
  tier: PlanTier,
  planId: string,
  boardId: string,
  of?: OwnerScope,
): Promise<void> {
  return tier.release(GAUGE, roadmapKey(planId, boardId), of);
}

/**
 * What a claim's answer makes of the row's mark: true (it holds a place), false (refused at the limit), or null to
 * leave the mark as it is (nothing counted it: Pro off, the service out of reach or refusing the request).
 */
export function markOfClaim(claim: GaugeResult | null): boolean | null {
  if (!claim || claim.unmetered) return null;
  return claim.ok;
}

/**
 * The plan's roadmaps as the service should hold them, `rows` oldest first: each whose board is there claims its
 * place (one from before Pro, one whose board came back, one published while the service was out of reach), each
 * whose board has gone gives it back. `mark` writes a row's changed mark. A key is asked about at most once a
 * minute, whatever the answer, and the service's refusal of the request itself changes nothing.
 */
export async function syncRoadmapGauge(
  tier: PlanTier,
  planId: string,
  rows: readonly CountedRow[],
  there: (boardId: string) => boolean,
  mark: (boardId: string, counted: boolean) => Promise<void> | void,
): Promise<void> {
  const marks = new Map(rows.map((r) => [r.boardId, r.counted]));
  const heldBut = (boardId: string) =>
    [...marks].filter(([id, counted]) => id !== boardId && counted === true && there(id)).length;
  for (const { boardId } of rows) {
    const key = roadmapKey(planId, boardId);
    const before = marks.get(boardId) ?? null;
    if (!there(boardId)) {
      if (before !== false) {
        marks.set(boardId, false);
        await mark(boardId, false);
      }
      if (!tier.told(key, false)) await releaseRoadmap(tier, planId, boardId);
      continue;
    }
    if (tier.told(key, true)) continue;
    const claim = await claimRoadmap(tier, planId, boardId, heldBut(boardId));
    if (claim && refusedByService(claim)) continue;
    const next = markOfClaim(claim);
    if (next === null || next === before) continue;
    marks.set(boardId, next);
    await mark(boardId, next);
  }
}

/** The plan's daily upkeep: its roadmaps synced, so a board deleted from the canvas gives its place back. */
export async function syncPlanRoadmaps(env: PlanEnv, planId: string): Promise<void> {
  const tier = await tierOn(env);
  if (!tier) return;
  const rows = await roadmapsOf(env, planId);
  if (rows.length === 0) return;
  const boards = await roadmapBoardsOf(env, planId, await planTypesOf(env, planId));
  await syncRoadmapGauge(
    tier,
    planId,
    rows,
    (id) => boards.some((b) => b.id === id),
    (boardId, counted) => setRoadmapCounted(env, planId, boardId, counted),
  );
}

/** A deleted tab's roadmaps given back (their rows stay, answering nobody, as a deleted board's do). */
export async function releaseTabRoadmaps(
  env: PlanEnv,
  planId: string,
  tabId: string,
): Promise<void> {
  const tier = await tierOn(env);
  if (!tier) return;
  for (const row of await roadmapsOf(env, planId))
    if (row.tabId === tabId) {
      await setRoadmapCounted(env, planId, row.boardId, false);
      await releaseRoadmap(tier, planId, row.boardId);
    }
}

// The plan's roadmap rows, oldest first, read straight from its SQLite (the room's own paths, which hold no env).
function publishedRows(sql: Sql, planId: string): CountedRow[] {
  return sql
    .exec<{ board_id: string; counted: number | null }>(
      'SELECT board_id, counted FROM roadmaps WHERE plan_id = ? ORDER BY created_at, board_id',
      planId,
    )
    .toArray()
    .map((row) => ({
      boardId: row.board_id,
      counted: row.counted === null ? null : Number(row.counted) === 1,
    }));
}

/** The plan is going for good: every roadmap given back before its storage is dropped. Never throws. */
export async function leaveRoadmapGauge(tier: PlanTier, sql: Sql, planId: string): Promise<void> {
  if (!tier.on) return;
  try {
    const rows = publishedRows(sql, planId);
    if (rows.length === 0) return;
    if (!tier.fresh()) await tier.refresh();
    for (const { boardId } of rows) await releaseRoadmap(tier, planId, boardId);
  } catch (error) {
    console.warn('[roadmap] gauge.leave.failed', { error: String(error) });
  }
}

/**
 * The plan moved to another owner (or team, or from a guest to the account they signed in to): its roadmaps leave
 * `from`'s count (null: a guest's, which the service never held) and claim their places with the new owner, oldest
 * first. One the new owner has no place for holds none, so it answers nobody until it is published within their
 * limit: a move is never a way past it. Never throws.
 */
export async function moveRoadmapGauge(
  tier: PlanTier,
  sql: Sql,
  planId: string,
  from: OwnerScope | null,
): Promise<void> {
  if (!tier.on) return;
  try {
    const rows = publishedRows(sql, planId);
    if (rows.length === 0) return;
    if (from !== null)
      for (const { boardId } of rows) await releaseRoadmap(tier, planId, boardId, from);
    await tier.refresh();
    // The rows that held a place (or were never counted) ask the new owner for one; a board the count knew gone
    // stays as it was until the next count sees it back.
    const asking = rows.filter((r) => r.counted !== false);
    await syncRoadmapGauge(
      tier,
      planId,
      asking.map((r) => ({ boardId: r.boardId, counted: null })),
      () => true,
      (boardId, counted) =>
        void sql.exec(
          'UPDATE roadmaps SET counted = ? WHERE plan_id = ? AND board_id = ?',
          counted ? 1 : 0,
          planId,
          boardId,
        ),
    );
  } catch (error) {
    console.warn('[roadmap] gauge.move.failed', { error: String(error) });
  }
}
