// Pull request state (docs/specs/026-plan/github-pull-requests.md "Pull request state on cards"; blueprint "Part 3"):
// the latest a plan has heard of a linked pull request, as the api keeps it and every screen draws it, and the card's
// linked pull requests with their states. Pure: nothing here calls GitHub.
import type { Item, ItemPerson } from './item';
import type { ItemTypeDef } from './item-types';
import {
  LINKED_PULL_REQUESTS_MAX,
  parsePullRequestUrl,
  pullRequestKey,
  type PullRequestRef,
} from './pull-request-fields';

/** Where a pull request stands: a draft, open (ready for review), merged, or closed without merging. */
export type PullRequestState = 'draft' | 'open' | 'merged' | 'closed';
/** Its newest commit's check suites together. */
export type PullRequestChecks = 'running' | 'passing' | 'failing';

/** One pull request's state as a plan holds it. */
export type PullRequestStatus = {
  // `pullRequestKey`: the short name lower-cased.
  key: string;
  // The canonical address, `https://github.com/{owner}/{repo}/pull/{number}`.
  url: string;
  title: string;
  state: PullRequestState;
  // Absent until its newest commit's checks report.
  checks?: PullRequestChecks;
  // The ids of the cards its title or body names; absent for none.
  cards?: string[];
  // GitHub's `updated_at`, ms.
  updatedAt: number;
};

// GitHub's own cap on a title; a plan's recent pull requests and commits; one delivery's card moves (spec "Limits").
export const PULL_REQUEST_TITLE_MAX = 256;
export const PULL_REQUESTS_KEPT = 500;
export const CHECK_SUITES_KEPT = 2000;
export const RULE_MOVES_MAX = 50;

/** Who GitHub's moves are by (spec "GitHub rules"); its history entries are tagged 'github'. */
export const GITHUB_PERSON_ID = 'github';
export const GITHUB_PERSON: ItemPerson = { id: GITHUB_PERSON_ID, name: 'GitHub', color: '#1f2328' };

export type PullRequestStatusLabel =
  | 'Draft'
  | 'Open'
  | 'Checks Running'
  | 'Checks Passing'
  | 'Checks Failing'
  | 'Merged'
  | 'Closed';

const CHECKS_LABEL: Record<PullRequestChecks, PullRequestStatusLabel> = {
  running: 'Checks Running',
  passing: 'Checks Passing',
  failing: 'Checks Failing',
};

/** The state in words. An open pull request's checks name it once they report; a draft stays Draft. */
export function pullRequestStatusLabel(
  s: Pick<PullRequestStatus, 'state' | 'checks'>,
): PullRequestStatusLabel {
  if (s.state === 'merged') return 'Merged';
  if (s.state === 'closed') return 'Closed';
  if (s.state === 'draft') return 'Draft';
  return s.checks ? CHECKS_LABEL[s.checks] : 'Open';
}

/** Whether the pull request's checks are worth showing: it is open or a draft, and they reported. */
export const showsChecks = (s: Pick<PullRequestStatus, 'state' | 'checks'>): boolean =>
  (s.state === 'open' || s.state === 'draft') && s.checks !== undefined;

/** A commit's check suites together: failing over running over passing; undefined for none. */
export function checksOf(results: readonly PullRequestChecks[]): PullRequestChecks | undefined {
  if (results.length === 0) return undefined;
  if (results.includes('failing')) return 'failing';
  return results.includes('running') ? 'running' : 'passing';
}

/** The lookups a card reads: each state by its key, and the ones naming each card. */
export type PullRequestStatuses = {
  byKey: ReadonlyMap<string, PullRequestStatus>;
  byCard: ReadonlyMap<string, readonly PullRequestStatus[]>;
};

export const NO_PULL_REQUEST_STATUSES: PullRequestStatuses = {
  byKey: new Map(),
  byCard: new Map(),
};

export function pullRequestStatuses(list: readonly PullRequestStatus[]): PullRequestStatuses {
  if (list.length === 0) return NO_PULL_REQUEST_STATUSES;
  const byKey = new Map<string, PullRequestStatus>();
  const byCard = new Map<string, PullRequestStatus[]>();
  for (const s of list) {
    byKey.set(s.key, s);
    for (const card of s.cards ?? []) {
      const held = byCard.get(card);
      if (held) held.push(s);
      else byCard.set(card, [s]);
    }
  }
  return { byKey, byCard };
}

/** One of a card's linked pull requests: what it is, its state when the plan has one, and the field holding it. */
export type CardPullRequest = { ref: PullRequestRef; status?: PullRequestStatus; field?: string };

/**
 * A card's linked pull requests (spec "How a card names its pull requests"): its Pull Request fields', then its Link
 * fields' pull requests, then the ones naming it, each once, at most `LINKED_PULL_REQUESTS_MAX`.
 */
export function cardLinkedPullRequests(
  item: Pick<Item, 'id' | 'fields'>,
  type: Pick<ItemTypeDef, 'custom'> | undefined,
  statuses: PullRequestStatuses,
): CardPullRequest[] {
  const out: CardPullRequest[] = [];
  const seen = new Set<string>();
  const add = (ref: PullRequestRef, field?: string) => {
    const key = pullRequestKey(ref);
    if (seen.has(key) || out.length >= LINKED_PULL_REQUESTS_MAX) return;
    seen.add(key);
    const status = statuses.byKey.get(key);
    out.push({ ref, ...(status ? { status } : {}), ...(field ? { field } : {}) });
  };
  const custom = type?.custom ?? [];
  for (const kind of ['pullrequest', 'link'] as const)
    for (const f of custom) {
      if (f.kind !== kind) continue;
      const ref = parsePullRequestUrl(item.fields[f.id]);
      if (ref) add(ref, f.id);
    }
  for (const s of statuses.byCard.get(item.id) ?? []) {
    const ref = parsePullRequestUrl(s.url);
    if (ref) add(ref);
  }
  return out;
}

/** Two picks of a card's linked pull requests alike: the same pull requests, states and fields, in order. */
export function sameCardPullRequests(
  a: readonly CardPullRequest[],
  b: readonly CardPullRequest[],
): boolean {
  return (
    a.length === b.length &&
    a.every((x, i) => {
      const y = b[i]!;
      return (
        pullRequestKey(x.ref) === pullRequestKey(y.ref) &&
        x.status === y.status &&
        x.field === y.field
      );
    })
  );
}
