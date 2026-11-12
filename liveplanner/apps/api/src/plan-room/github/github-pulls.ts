// What a plan does with a pull request's or a check suite's delivery (docs/specs/026-plan/github-pull-requests.md "Pull
// request state on cards", "GitHub triggers"; blueprint "Part 3" and "Part 4" `github-pulls.ts`): the state kept
// unless the plan holds a newer one, sent to every screen, and, when the pull request opened, merged, closed or its
// checks changed into failing or passing, the plan's GitHub-triggered rules queued on the cards it links. A stale
// delivery keeps nothing and starts nothing, so a rule never hears a pull request go backwards.
import {
  cardMentions,
  heardOfChecks,
  heardOfPull,
  parsePullRequestUrl,
  pullRequestKey,
  pullRequestText,
  typesOf,
  type ItemTypeDef,
  type PullRequestStatus,
} from '@liveplanner/items';
import type { PullRequestsRoomOp } from '@liveplanner/api-schema';
import type { DeliveredCheckSuite, DeliveredPullRequest } from '../../github/github-payloads';
import { readPlanOutline } from '../plan-content';
import { fieldCardIds, mentionedCardIds } from './github-cards';
import { keysAtHead, statusesOf, upsertPull, upsertSuite } from './github-pulls-store';
import { hearsGithub, queueGithubRuns } from './github-runs';
import type { PlanEnv } from '../../types';

export type PullDeps = {
  env: PlanEnv;
  planId: string;
  // Hands new states to the room.
  send: (op: PullRequestsRoomOp) => void;
};

async function sendStates(deps: PullDeps, keys: readonly string[]): Promise<PullRequestStatus[]> {
  const upserts = await statusesOf(deps.env.PLAN_DB, keys);
  if (upserts.length) deps.send({ kind: 'pull-requests', upserts, removed: [] });
  return upserts;
}

const planTypes = async (env: PlanEnv, planId: string): Promise<readonly ItemTypeDef[]> =>
  typesOf((await readPlanOutline(env, planId)).itemTypes);

/** A `pull_request` delivery acted on: answers how many runs it queued. */
export async function actOnPullRequest(
  deps: PullDeps,
  deliveryId: string,
  action: string,
  pr: DeliveredPullRequest,
  now: number,
): Promise<number> {
  const { env, planId } = deps;
  const head = await readPlanOutline(env, planId);
  const numbers = cardMentions(`${pr.title}\n${pr.body}`, head.meta?.name ?? '');
  const mentioned = await mentionedCardIds(env, planId, numbers);
  if (!(await upsertPull(env.PLAN_DB, pr, mentioned, now))) {
    console.info('[github] pull.stale', { action });
    return 0;
  }
  await sendStates(deps, [pullRequestKey(pr.ref)]);
  const heard = heardOfPull(action, pr.state);
  if (heard === null || !hearsGithub(env)) return 0;
  const linked = [
    ...(await fieldCardIds(env, planId, typesOf(head.itemTypes), pr.ref)),
    ...mentioned,
  ];
  return queueGithubRuns(env, heard, pullRequestText(pr.ref), linked, deliveryId, now);
}

/** A `check_suite` delivery acted on: its result kept, the pull requests at its commit sent again, and each whose
 *  checks changed into failing or passing starting its rules. Answers how many runs it queued. */
export async function actOnCheckSuite(
  deps: PullDeps,
  deliveryId: string,
  suite: DeliveredCheckSuite,
  now: number,
): Promise<number> {
  const { env, planId } = deps;
  const db = env.PLAN_DB;
  const keys = await keysAtHead(db, suite.repoId, suite.headSha);
  // The checks before, only when a rule could hear them change.
  const listening = hearsGithub(env) && keys.length > 0;
  const before = listening ? new Map((await statusesOf(db, keys)).map((s) => [s.key, s])) : null;
  if (!(await upsertSuite(db, suite))) {
    console.info('[github] suite.stale', {});
    return 0;
  }
  const after = keys.length ? await sendStates(deps, keys) : [];
  if (!before) return 0;
  let queued = 0;
  let types: readonly ItemTypeDef[] | null = null;
  for (const status of after) {
    const heard = heardOfChecks(before.get(status.key), status);
    const ref = heard ? parsePullRequestUrl(status.url) : null;
    if (!heard || !ref) continue;
    types ??= await planTypes(env, planId);
    const linked = [...(await fieldCardIds(env, planId, types, ref)), ...(status.cards ?? [])];
    queued += await queueGithubRuns(env, heard, pullRequestText(ref), linked, deliveryId, now);
  }
  return queued;
}
