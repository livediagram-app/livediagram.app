// What a plan keeps of a `pull_request` or `check_suite` delivery (docs/specs/026-plan/github-pull-requests.md "Pull
// request state on cards"; blueprint "Part 3" "Reading a delivery"). Pure: the payload is GitHub's, verified, but read
// as untrusted shapes all the same, lengths capped and the address rebuilt from parsed parts.
import {
  MENTION_TEXT_MAX,
  PULL_REQUEST_TITLE_MAX,
  parsePullRequestUrl,
  type PullRequestChecks,
  type PullRequestRef,
  type PullRequestState,
} from '@liveplanner/items';

/** A GitHub id: a positive safe integer, or undefined. */
export const githubId = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined;

export type DeliveredPullRequest = {
  repoId: number;
  ref: PullRequestRef;
  title: string;
  body: string;
  state: PullRequestState;
  headSha: string;
  updatedAt: number;
};

export type DeliveredCheckSuite = {
  repoId: number;
  suiteId: number;
  headSha: string;
  checks: PullRequestChecks;
  updatedAt: number;
};

const field = (value: unknown, key: string): unknown =>
  typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;

const textOf = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.slice(0, max) : '';

// A commit's id: 7 to 64 hex digits (SHA-1 or SHA-256), lower-cased.
function shaOf(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length < 7 || value.length > 64) return undefined;
  const sha = value.toLowerCase();
  for (let i = 0; i < sha.length; i += 1) {
    const c = sha.charCodeAt(i);
    if (!((c >= 48 && c <= 57) || (c >= 97 && c <= 102))) return undefined;
  }
  return sha;
}

// An ISO time as ms, or undefined.
function timeOf(value: unknown): number | undefined {
  if (typeof value !== 'string' || value.length > 40) return undefined;
  const at = Date.parse(value);
  return Number.isFinite(at) ? at : undefined;
}

function stateOf(pr: unknown): PullRequestState {
  if (field(pr, 'merged') === true || typeof field(pr, 'merged_at') === 'string') return 'merged';
  if (field(pr, 'state') === 'closed') return 'closed';
  return field(pr, 'draft') === true ? 'draft' : 'open';
}

/** A `pull_request` delivery's pull request, or null when a part a plan needs does not read. */
export function readPullRequest(payload: unknown): DeliveredPullRequest | null {
  const repo = field(payload, 'repository');
  const pr = field(payload, 'pull_request');
  const repoId = githubId(field(repo, 'id'));
  const number = githubId(field(pr, 'number'));
  const fullName = field(repo, 'full_name');
  const headSha = shaOf(field(field(pr, 'head'), 'sha'));
  const updatedAt = timeOf(field(pr, 'updated_at'));
  if (repoId === undefined || number === undefined || typeof fullName !== 'string') return null;
  if (headSha === undefined || updatedAt === undefined || fullName.length > 140) return null;
  // The address rebuilt from GitHub's name and number, so it reads as any pasted one does.
  const ref = parsePullRequestUrl(`https://github.com/${fullName}/pull/${number}`);
  if (!ref) return null;
  return {
    repoId,
    ref,
    title: textOf(field(pr, 'title'), PULL_REQUEST_TITLE_MAX),
    body: textOf(field(pr, 'body'), MENTION_TEXT_MAX),
    state: stateOf(pr),
    headSha,
    updatedAt,
  };
}

// The conclusions a suite passes with (spec "Pull request state on cards"); any other completed one fails.
const PASSING = new Set(['success', 'neutral', 'skipped']);

/** A `check_suite` delivery's suite, or null when a part a plan needs does not read. */
export function readCheckSuite(payload: unknown): DeliveredCheckSuite | null {
  const suite = field(payload, 'check_suite');
  const repoId = githubId(field(field(payload, 'repository'), 'id'));
  const suiteId = githubId(field(suite, 'id'));
  const headSha = shaOf(field(suite, 'head_sha'));
  const updatedAt = timeOf(field(suite, 'updated_at'));
  if (repoId === undefined || suiteId === undefined) return null;
  if (headSha === undefined || updatedAt === undefined) return null;
  const conclusion = field(suite, 'conclusion');
  const checks: PullRequestChecks =
    field(suite, 'status') !== 'completed'
      ? 'running'
      : typeof conclusion === 'string' && PASSING.has(conclusion)
        ? 'passing'
        : 'failing';
  return { repoId, suiteId, headSha, checks, updatedAt };
}
