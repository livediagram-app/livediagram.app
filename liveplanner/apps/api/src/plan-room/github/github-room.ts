// What the worker asks of a plan about GitHub (docs/specs/026-plan/github-pull-requests.md "Deliveries",
// "Connecting a repository"; blueprint "Part 2"), the `PlanRoom.github` RPC: a connect's callback, or a verified
// delivery. The plan's own connection is the truth: a delivery acts only when it names the plan's installation (and,
// for a pull request or its checks, a chosen repository), and only once per delivery id. A pull request's or a check
// suite's delivery keeps its state and queues the plan's GitHub-triggered rules (github-pulls.ts, github-runs.ts); a
// repository leaving the plan, or the App leaving the account, takes the states it held with it.
import type { PullRequestsRoomOp } from '@liveplanner/api-schema';
import { githubConfig } from '../../github/github-config';
import type { GithubDelivery } from '../../github/github-delivery';
import { NO_LINKS, rewriteLinks } from '../../github/github-links';
import type { PlanEnv } from '../../types';
import { relayPullRequests } from '../../room-client';
import { finishConnect, type ConnectCallback } from './github-connect';
import {
  dropConnection,
  dropRepositories,
  firstSight,
  forgetSight,
  linksOf,
  readConnection,
  type GithubConnection,
} from './github-store';
import { actOnCheckSuite, actOnPullRequest, type PullDeps } from './github-pulls';
import { dropPulls } from './github-pulls-store';

export type GithubRoomCall =
  ({ kind: 'callback' } & ConnectCallback) | { kind: 'delivery'; delivery: GithubDelivery };

/** A callback's: `connected` or `failed`. A delivery's: `accepted` (acted on), `replayed` (seen before) or
 *  `not_connected` (the plan's connection does not name it). */
export type GithubRoomAnswer = 'connected' | 'failed' | 'accepted' | 'replayed' | 'not_connected';

// Whether the delivery is about this plan's connection.
function names(c: GithubConnection | null, d: GithubDelivery): c is GithubConnection {
  if (!c || c.installationId !== d.installationId) return false;
  if (d.event !== 'pull_request' && d.event !== 'check_suite') return true;
  return c.repositories.some((r) => r.chosen && r.id === d.repositoryIds[0]);
}

// What a delivery's work hands the room, each awaited before the call answers: new states. (The rules it queues land
// their cards through the runner, as any rule's do.) `repositoryPrivate`: what the plan's kept list says of the
// delivery's repository.
function roomDeps(
  env: PlanEnv,
  planId: string,
  pending: Promise<void>[],
  repositoryPrivate: boolean | undefined,
): PullDeps {
  return {
    env,
    planId,
    send: (op: PullRequestsRoomOp) => void pending.push(relayPullRequests(env, planId, op)),
    ...(repositoryPrivate !== undefined ? { repositoryPrivate } : {}),
  };
}

/** The states the plan held for `repoIds` (null: every one) gone, and every screen told. */
export async function dropStates(
  env: PlanEnv,
  planId: string,
  repoIds: readonly number[] | null,
): Promise<void> {
  const removed = await dropPulls(env.PLAN_DB, repoIds);
  if (repoIds === null)
    await relayPullRequests(env, planId, {
      kind: 'pull-requests',
      upserts: [],
      removed: [],
      reset: true,
    });
  else if (removed.length)
    await relayPullRequests(env, planId, { kind: 'pull-requests', upserts: [], removed });
}

async function deliver(
  env: PlanEnv,
  planId: string,
  d: GithubDelivery,
  now: number,
): Promise<GithubRoomAnswer> {
  const db = env.PLAN_DB;
  const before = await readConnection(db, planId);
  if (!names(before, d)) return 'not_connected';
  if (!(await firstSight(db, d.id, now))) return 'replayed';
  try {
    await actOn(env, planId, d, before, now);
  } catch (error) {
    // Not seen after all: the retry GitHub makes, or a Redeliver, must act on it rather than answer `replayed`.
    await forgetSight(db, d.id);
    throw error;
  }
  return 'accepted';
}

async function actOn(
  env: PlanEnv,
  planId: string,
  d: GithubDelivery,
  before: Awaited<ReturnType<typeof readConnection>>,
  now: number,
): Promise<void> {
  const db = env.PLAN_DB;
  const links = githubConfig(env)?.links;
  if (d.event === 'installation') {
    await dropConnection(db, planId);
    await dropStates(env, planId, null);
    if (links) await rewriteLinks(links, planId, linksOf(before), NO_LINKS);
  } else if (d.event === 'installation_repositories') {
    await dropRepositories(db, planId, d.repositoryIds);
    await dropStates(env, planId, d.repositoryIds);
    if (links)
      await rewriteLinks(links, planId, linksOf(before), linksOf(await readConnection(db, planId)));
  } else {
    const pending: Promise<void>[] = [];
    const kept = before?.repositories.find((r) => r.id === d.repositoryIds[0]);
    const deps = roomDeps(env, planId, pending, kept?.private);
    if (d.pullRequest) await actOnPullRequest(deps, d.id, d.action, d.pullRequest, now);
    else if (d.checkSuite) await actOnCheckSuite(deps, d.id, d.checkSuite, now);
    await Promise.all(pending);
  }
}

/** One GitHub call to the plan. `schema`: whether the plan has one; an id nothing has written answers without
 *  making one. */
export async function answerGithubCall(
  input: { env: PlanEnv; planId: string; schema: boolean },
  call: GithubRoomCall,
  now: number,
): Promise<GithubRoomAnswer> {
  const { env, planId, schema } = input;
  if (call.kind === 'callback') {
    const config = githubConfig(env);
    if (!schema || !config) return 'failed';
    const { kind: _kind, ...callback } = call;
    return finishConnect(env.PLAN_DB, config, planId, callback, now);
  }
  if (!schema) return 'not_connected';
  return deliver(env, planId, call.delivery, now);
}

/** A plan going for good takes its keys out of the reverse index. A failure is logged; the next delivery that finds
 *  the plan gone deletes its key all the same. */
export async function leaveGithub(env: PlanEnv, planId: string): Promise<void> {
  const links = githubConfig(env)?.links;
  if (!links) return;
  try {
    await rewriteLinks(links, planId, linksOf(await readConnection(env.PLAN_DB, planId)), NO_LINKS);
  } catch (err) {
    console.warn('[github] leave failed', { error: String(err) });
  }
}
