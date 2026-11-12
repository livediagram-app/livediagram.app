// What a plan does with a pull request's or a check suite's delivery (docs/specs/026-plan/github-pull-requests.md "Pull
// request state on cards", "GitHub rules"; blueprint "Part 3" `github-pulls.ts`): the state kept unless the plan holds
// a newer one, sent to every screen, and, when the pull request opened or merged, the rule's moves made.
import {
  RULE_MOVES_MAX,
  cardMentions,
  pullRequestKey,
  typesOf,
  type PullRequestState,
} from '@liveplanner/items';
import type { GithubRules, PullRequestsRoomOp } from '@liveplanner/api-schema';
import type { DeliveredCheckSuite, DeliveredPullRequest } from '../../github/github-payloads';
import { readPlanOutline } from '../plan-content';
import { fieldCardIds, mentionedCardIds } from './github-cards';
import { moveForRule, type MoveDeps } from './github-moves';
import { keysAtHead, statusesOf, upsertPull, upsertSuite } from './github-pulls-store';

export type PullDeps = MoveDeps & {
  // Hands new states to the room.
  send: (op: PullRequestsRoomOp) => void;
};

/** The rule an action of a pull request now in `state` runs, or null: opened (or reopened, or a draft marked ready)
 *  and open; closed as merged. */
export function ruleFor(
  rules: GithubRules,
  action: string,
  state: PullRequestState,
): string | null {
  const opens = action === 'opened' || action === 'reopened' || action === 'ready_for_review';
  if (opens && state === 'open') return rules.opened;
  if (action === 'closed' && state === 'merged') return rules.merged;
  return null;
}

async function sendStates(deps: PullDeps, keys: readonly string[]): Promise<void> {
  const upserts = await statusesOf(deps.env.PLAN_DB, keys);
  if (upserts.length) deps.send({ kind: 'pull-requests', upserts, removed: [] });
}

/** A `pull_request` delivery acted on: answers how many cards its rule moved. */
export async function actOnPullRequest(
  deps: PullDeps,
  rules: GithubRules,
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
  const target = ruleFor(rules, action, pr.state);
  if (target === null) return 0;
  const types = typesOf(head.itemTypes);
  const linked = new Set([...(await fieldCardIds(env, planId, types, pr.ref)), ...mentioned]);
  return moveForRule(deps, types, target, [...linked].slice(0, RULE_MOVES_MAX), now);
}

/** A `check_suite` delivery acted on: its result kept, and the pull requests at its commit sent again. */
export async function actOnCheckSuite(deps: PullDeps, suite: DeliveredCheckSuite): Promise<void> {
  const db = deps.env.PLAN_DB;
  if (!(await upsertSuite(db, suite))) {
    console.info('[github] suite.stale', {});
    return;
  }
  await sendStates(deps, await keysAtHead(db, suite.repoId, suite.headSha));
}
