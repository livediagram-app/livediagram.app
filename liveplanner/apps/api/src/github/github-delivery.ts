// What a plan needs of a verified delivery (docs/specs/026-plan/github-pull-requests.md "Deliveries"; blueprint
// "Part 2"): its id, event and action, the installation, and the repositories it is about. Pure: the payload is
// GitHub's, already verified, but read as untrusted shapes all the same.
import { INSTALLATION_REPOSITORIES_LISTED } from './github-config';
import {
  githubId,
  readCheckSuite,
  readPullRequest,
  type DeliveredCheckSuite,
  type DeliveredPullRequest,
} from './github-payloads';

export { githubId };

/** The events a plan hears in this part; any other is accepted and ignored. */
export type GithubEvent =
  'pull_request' | 'check_suite' | 'installation_repositories' | 'installation';

export type GithubDelivery = {
  id: string;
  event: GithubEvent;
  action: string;
  installationId: number;
  // `pull_request` and `check_suite`: the one repository; `installation_repositories`: the ones removed;
  // `installation`: none (every repository under it).
  repositoryIds: number[];
  // `pull_request`: the pull request as a plan keeps it; `check_suite`: the suite (part 3).
  pullRequest?: DeliveredPullRequest;
  checkSuite?: DeliveredCheckSuite;
};

const DELIVERY_ID_MAX = 100;
const ACTION_MAX = 64;

/** Whether `id` reads as an `X-GitHub-Delivery` (a GUID): 1 to 100 letters, digits and hyphens. */
export function isDeliveryId(id: string | null): id is string {
  if (!id || id.length > DELIVERY_ID_MAX) return false;
  for (let i = 0; i < id.length; i += 1) {
    const c = id.charCodeAt(i);
    const ok = (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 45;
    if (!ok) return false;
  }
  return true;
}

const field = (value: unknown, key: string): unknown =>
  typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;

const actionOf = (payload: unknown): string => {
  const action = field(payload, 'action');
  return typeof action === 'string' && action.length <= ACTION_MAX ? action : '';
};

/** The delivery as a plan reads it, or null for an event (or an action) this part does nothing with. */
export function readDelivery(
  event: string | null,
  id: string,
  payload: unknown,
): GithubDelivery | null {
  const installationId = githubId(field(field(payload, 'installation'), 'id'));
  if (installationId === undefined) return null;
  const action = actionOf(payload);
  const base = { id, action, installationId };
  if (event === 'pull_request') {
    const pullRequest = readPullRequest(payload);
    return pullRequest
      ? { ...base, event, repositoryIds: [pullRequest.repoId], pullRequest }
      : null;
  }
  if (event === 'check_suite') {
    const checkSuite = readCheckSuite(payload);
    return checkSuite ? { ...base, event, repositoryIds: [checkSuite.repoId], checkSuite } : null;
  }
  if (event === 'installation_repositories') {
    if (action !== 'removed') return null;
    const removed = field(payload, 'repositories_removed');
    if (!Array.isArray(removed)) return null;
    const ids = new Set<number>();
    for (const r of removed.slice(0, INSTALLATION_REPOSITORIES_LISTED)) {
      const repo = githubId(field(r, 'id'));
      if (repo !== undefined) ids.add(repo);
    }
    return ids.size === 0 ? null : { ...base, event, repositoryIds: [...ids] };
  }
  if (event === 'installation')
    return action === 'deleted' ? { ...base, event, repositoryIds: [] } : null;
  return null;
}
