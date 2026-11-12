// The pull request states `GET /items` answers with the cards (docs/specs/026-plan/github-pull-requests.md "Pull
// request state on cards", "What a share link sees"; blueprint "Part 3" "The routes"): for a plan connected to GitHub,
// the states of the pull requests the answered cards link, by a field or by naming them; a tab-scoped caller's alone,
// each naming only the cards it answers. None while the feature is off, for a plan with no connection, or for a
// Community visitor, whose post shows the plan's cards and never what GitHub holds.
import {
  cardPullRequests,
  pullRequestKey,
  typeIn,
  typesOf,
  type Item,
  type PullRequestStatus,
} from '@liveplanner/items';
import { githubConfig } from '../github/github-config';
import { statusesOf } from '../plan-room/github/github-pulls-store';
import type { ItemCaller } from './item-route-kit';
import type { PlanRouteContext } from './context';

export async function pullRequestsFor(
  ctx: PlanRouteContext,
  caller: ItemCaller,
  items: readonly Item[],
): Promise<PullRequestStatus[] | undefined> {
  if (caller.community || !githubConfig(ctx.env)) return undefined;
  const db = ctx.env.PLAN_DB;
  const connected = await db
    .prepare('SELECT 1 AS on_ FROM github_connection WHERE plan_id = ?')
    .bind(caller.projectId)
    .first<{ on_: number }>();
  if (!connected) return undefined;
  const kept = await statusesOf(db, null);
  if (kept.length === 0) return [];
  const types = typesOf(caller.doc?.itemTypes);
  const ids = new Set<string>();
  const keys = new Set<string>();
  for (const item of items) {
    ids.add(item.id);
    for (const ref of cardPullRequests(item, typeIn(types, item.type)))
      keys.add(pullRequestKey(ref));
  }
  const out: PullRequestStatus[] = [];
  for (const s of kept) {
    const cards = s.cards?.filter((id) => ids.has(id)) ?? [];
    if (!keys.has(s.key) && cards.length === 0) continue;
    const { cards: _all, ...rest } = s;
    out.push(cards.length ? { ...rest, cards } : rest);
  }
  return out;
}
