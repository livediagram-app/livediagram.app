// The cards a pull request links (docs/specs/026-plan/github-pull-requests.md "How a card names its pull requests";
// blueprint "Part 3" "The plan's object"): the ones its title or body names, by number, and the ones whose fields hold
// its address. Neither reads every card's text in code: the numbers are looked up by `item_key` (indexed), and a
// field's address is found by SQLite's `LIKE` over the stored fields, each hit then confirmed as the card reads it.
import {
  cardPullRequests,
  isTrashed,
  pullRequestKey,
  typeIn,
  type ItemTypeDef,
  type PullRequestRef,
} from '@liveplanner/items';
import { readItems } from '../../db/items';
import type { PlanEnv } from '../../types';

/** The ids of the plan's cards numbered `numbers` that are out of the Trash, in the order named. */
export async function mentionedCardIds(
  env: PlanEnv,
  planId: string,
  numbers: readonly number[],
): Promise<string[]> {
  if (numbers.length === 0) return [];
  const res = await env.PLAN_DB.prepare(
    `SELECT id, item_key FROM items WHERE plan_id = ? AND item_key IN (SELECT value FROM json_each(?))`,
  )
    .bind(planId, JSON.stringify(numbers))
    .all<{ id: string; item_key: number }>();
  const rows = res.results ?? [];
  if (rows.length === 0) return [];
  const live = new Set(
    (
      await readItems(
        env,
        planId,
        rows.map((r) => r.id),
      )
    )
      .filter((i) => !isTrashed(i))
      .map((i) => i.id),
  );
  const byKey = new Map(rows.map((r) => [Number(r.item_key), r.id]));
  return numbers.flatMap((n) => {
    const id = byKey.get(n);
    return id && live.has(id) ? [id] : [];
  });
}

/** The ids of the plan's cards whose fields hold the pull request (a Pull Request field or a Link field). */
export async function fieldCardIds(
  env: PlanEnv,
  planId: string,
  types: readonly ItemTypeDef[],
  ref: PullRequestRef,
): Promise<string[]> {
  // Any address of it holds this run of text (with or without www., a page after the number), matched case-blind
  // as owners and repositories are. `/pull/4` also finds `/pull/42`: every hit is confirmed below. `instr`, never a
  // bound LIKE: Durable Object SQLite refuses a LIKE pattern over 50 bytes, and every repository's address is longer.
  const needle = `github.com/${ref.owner}/${ref.repo}/pull/${ref.number}`.toLowerCase();
  const res = await env.PLAN_DB.prepare(
    `SELECT id FROM items WHERE plan_id = ? AND instr(lower(fields), ?) > 0`,
  )
    .bind(planId, needle)
    .all<{ id: string }>();
  const ids = (res.results ?? []).map((r) => r.id);
  if (ids.length === 0) return [];
  const key = pullRequestKey(ref);
  return (await readItems(env, planId, ids))
    .filter(
      (item) =>
        !isTrashed(item) &&
        cardPullRequests(item, typeIn(types, item.type)).some((r) => pullRequestKey(r) === key),
    )
    .map((item) => item.id);
}
