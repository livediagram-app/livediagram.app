import { describe, expect, it } from 'vitest';
import {
  LINKED_PULL_REQUESTS_MAX,
  NO_PULL_REQUEST_STATUSES,
  cardLinkedPullRequests,
  checksOf,
  pullRequestStatusLabel,
  pullRequestStatuses,
  sameCardPullRequests,
  showsChecks,
  type PullRequestStatus,
} from './index';

// Pull request state as every screen reads it (docs/specs/026-plan/github-pull-requests.md "Pull request state on
// cards").

const status = (n: number, o: Partial<PullRequestStatus> = {}): PullRequestStatus => ({
  key: `acme/web#${n}`,
  url: `https://github.com/acme/web/pull/${n}`,
  title: `PR ${n}`,
  state: 'open',
  updatedAt: 1,
  ...o,
});

describe('the state in words', () => {
  it('names merged, closed and draft, then an open one by its checks', () => {
    expect(pullRequestStatusLabel({ state: 'merged', checks: 'failing' })).toBe('Merged');
    expect(pullRequestStatusLabel({ state: 'closed' })).toBe('Closed');
    expect(pullRequestStatusLabel({ state: 'draft', checks: 'passing' })).toBe('Draft');
    expect(pullRequestStatusLabel({ state: 'open' })).toBe('Open');
    expect(pullRequestStatusLabel({ state: 'open', checks: 'running' })).toBe('Checks Running');
    expect(pullRequestStatusLabel({ state: 'open', checks: 'passing' })).toBe('Checks Passing');
    expect(pullRequestStatusLabel({ state: 'open', checks: 'failing' })).toBe('Checks Failing');
  });

  it('shows checks only on an open or draft pull request that has them', () => {
    expect(showsChecks({ state: 'open', checks: 'passing' })).toBe(true);
    expect(showsChecks({ state: 'draft', checks: 'failing' })).toBe(true);
    expect(showsChecks({ state: 'open' })).toBe(false);
    expect(showsChecks({ state: 'merged', checks: 'passing' })).toBe(false);
  });

  it('folds suites: failing over running over passing', () => {
    expect(checksOf([])).toBeUndefined();
    expect(checksOf(['passing', 'passing'])).toBe('passing');
    expect(checksOf(['passing', 'running'])).toBe('running');
    expect(checksOf(['running', 'failing', 'passing'])).toBe('failing');
  });
});

describe('a card’s linked pull requests', () => {
  const type = {
    custom: [
      { id: 'link', label: 'Link', kind: 'link' as const },
      { id: 'pr', label: 'Pull Request', kind: 'pullrequest' as const },
    ],
  };

  it('reads fields first (Pull Request, then Link), then the ones naming it, each once', () => {
    const statuses = pullRequestStatuses([
      status(1),
      status(2, { cards: ['c1', 'c2'] }),
      status(3, { cards: ['c1'] }),
    ]);
    const linked = cardLinkedPullRequests(
      {
        id: 'c1',
        fields: {
          pr: 'https://github.com/acme/web/pull/1',
          link: 'https://github.com/acme/web/pull/2',
        },
      },
      type,
      statuses,
    );
    expect(linked.map((l) => [l.ref.number, l.field, l.status?.key])).toEqual([
      [1, 'pr', 'acme/web#1'],
      [2, 'link', 'acme/web#2'],
      [3, undefined, 'acme/web#3'],
    ]);
    expect(statuses.byCard.get('c2')!.map((s) => s.key)).toEqual(['acme/web#2']);
  });

  it('holds a field’s pull request with no state yet, skips the rest, and stops at the cap', () => {
    const none = cardLinkedPullRequests(
      { id: 'c', fields: { pr: 'https://github.com/acme/web/pull/9', link: 'https://example.com' } },
      type,
      NO_PULL_REQUEST_STATUSES,
    );
    expect(none).toEqual([{ ref: { owner: 'acme', repo: 'web', number: 9 }, field: 'pr' }]);
    expect(
      cardLinkedPullRequests({ id: 'c', fields: {} }, undefined, NO_PULL_REQUEST_STATUSES),
    ).toEqual([]);
    expect(pullRequestStatuses([])).toBe(NO_PULL_REQUEST_STATUSES);
    const many = pullRequestStatuses(
      Array.from({ length: LINKED_PULL_REQUESTS_MAX + 3 }, (_, i) =>
        status(i + 1, { cards: ['c'] }),
      ),
    );
    expect(cardLinkedPullRequests({ id: 'c', fields: {} }, type, many).length).toBe(
      LINKED_PULL_REQUESTS_MAX,
    );
    // A state whose address is not a pull request's adds nothing.
    const odd = pullRequestStatuses([status(1, { url: 'nope', cards: ['c'] })]);
    expect(cardLinkedPullRequests({ id: 'c', fields: {} }, type, odd)).toEqual([]);
  });

  it('compares two picks by pull request, state and field', () => {
    const s = status(1);
    const a = [{ ref: { owner: 'acme', repo: 'web', number: 1 }, status: s, field: 'pr' }];
    expect(sameCardPullRequests(a, [{ ...a[0]! }])).toBe(true);
    expect(sameCardPullRequests(a, [])).toBe(false);
    expect(sameCardPullRequests(a, [{ ...a[0]!, status: status(1) }])).toBe(false);
    expect(sameCardPullRequests(a, [{ ...a[0]!, field: 'link' }])).toBe(false);
    expect(
      sameCardPullRequests(a, [{ ...a[0]!, ref: { owner: 'acme', repo: 'web', number: 2 } }]),
    ).toBe(false);
  });
});
