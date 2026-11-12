// What the worker asks of a plan about GitHub (docs/specs/026-plan/github-pull-requests.md "Deliveries",
// "Connecting a repository"; blueprint "Part 2"), the `PlanRoom.github` RPC: a connect's callback, or a verified
// delivery. The plan's own connection is the truth: a delivery acts only when it names the plan's installation (and,
// for a pull request or its checks, a chosen repository), and only once per delivery id.
import { githubConfig } from '../../github/github-config';
import type { GithubDelivery } from '../../github/github-delivery';
import { NO_LINKS, rewriteLinks } from '../../github/github-links';
import type { PlanEnv } from '../../types';
import { finishConnect, type ConnectCallback } from './github-connect';
import {
  dropConnection,
  dropRepositories,
  firstSight,
  linksOf,
  readConnection,
  type GithubConnection,
} from './github-store';

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
  const links = githubConfig(env)?.links;
  if (d.event === 'installation') {
    await dropConnection(db, planId);
    if (links) await rewriteLinks(links, planId, linksOf(before), NO_LINKS);
  } else if (d.event === 'installation_repositories') {
    await dropRepositories(db, planId, d.repositoryIds);
    if (links)
      await rewriteLinks(links, planId, linksOf(before), linksOf(await readConnection(db, planId)));
  }
  // pull_request and check_suite: part 3 reads them here (the pull request's state, the board's GitHub rules).
  return 'accepted';
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
