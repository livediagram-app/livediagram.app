// A card's linked pull requests as agents read them (docs/specs/026-plan/github-pull-requests.md "Agents"): the board's
// own pick, the ones with a state, never a state the api did not answer.
import { describe, expect, it } from 'vitest';
import {
  ITEM_TYPES,
  type Item,
  type ItemTypeDef,
  type PullRequestStatus,
} from '@liveplanner/items';
import { pullRequestLine, pullRequestLister } from './card-pull-requests';
import { planListing } from './plan-listing';
import type { PlanState } from './plan-state';

const by = { id: 'p', name: 'P', color: '#000000' };
const card = (id: string, key: number, fields: Item['fields'], type = 'dev'): Item => ({
  id,
  type,
  key,
  rank: 'i',
  fields: { title: id, status: 'todo', ...fields },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: by,
  updatedBy: by,
});
const DEV: ItemTypeDef = {
  ...ITEM_TYPES[0],
  id: 'dev',
  label: 'Dev',
  custom: [
    { id: 'f-pr', label: 'Pull Request', kind: 'pullrequest' },
    { id: 'f-link', label: 'Spec', kind: 'link' },
  ],
};
const TYPES = [...ITEM_TYPES, DEV];
const status = (key: string, over: Partial<PullRequestStatus> = {}): PullRequestStatus => ({
  key,
  url: `https://github.com/${key.replace('#', '/pull/')}`,
  title: `Title of ${key}`,
  state: 'open',
  updatedAt: 1,
  ...over,
});

describe('pullRequestLister', () => {
  it('lists none, and parses no card, when the api answered no states', () => {
    expect(pullRequestLister(undefined, TYPES)(card('a', 1, {}))).toBeUndefined();
    expect(pullRequestLister([], TYPES)(card('a', 1, {}))).toBeUndefined();
  });

  it('lists the field’s, the link’s, then the naming ones, each once, with states, checks and field names', () => {
    const list = pullRequestLister(
      [
        status('acme/web#1', { checks: 'failing' }),
        status('acme/web#2', { state: 'draft', checks: 'running' }),
        status('acme/web#3', { state: 'merged', checks: 'passing', cards: ['a'] }),
        // Names the card, but a field already holds it: listed once, as the field's.
        status('acme/web#1', { checks: 'failing', cards: ['a'] }),
        status('acme/other#9', { state: 'closed', cards: ['b'] }),
      ],
      TYPES,
    );
    const a = card('a', 1, {
      'f-pr': 'https://github.com/acme/web/pull/1',
      'f-link': 'https://github.com/acme/web/pull/2',
    });
    expect(list(a)).toEqual([
      {
        name: 'acme/web#1',
        state: 'open',
        checks: 'failing',
        title: 'Title of acme/web#1',
        url: 'https://github.com/acme/web/pull/1',
        field: 'Pull Request',
      },
      {
        name: 'acme/web#2',
        state: 'draft',
        checks: 'running',
        title: 'Title of acme/web#2',
        url: 'https://github.com/acme/web/pull/2',
        field: 'Spec',
      },
      // A merged one's checks are not worth showing, as on the board.
      {
        name: 'acme/web#3',
        state: 'merged',
        title: 'Title of acme/web#3',
        url: 'https://github.com/acme/web/pull/3',
      },
    ]);
  });

  it('leaves out a linked pull request the api answered no state for, and a card with none', () => {
    const list = pullRequestLister([status('acme/web#5')], TYPES);
    expect(list(card('c', 3, { 'f-pr': 'https://github.com/acme/web/pull/4' }))).toBeUndefined();
    expect(list(card('d', 4, {}, 'task'))).toBeUndefined();
  });

  it('prints one as its name, state and checks', () => {
    expect(
      pullRequestLine({ name: 'acme/web#1', state: 'open', checks: 'passing', title: '', url: '' }),
    ).toBe('acme/web#1 open, checks passing');
    expect(pullRequestLine({ name: 'acme/web#1', state: 'closed', title: '', url: '' })).toBe(
      'acme/web#1 closed',
    );
  });
});

describe('list_items with pull requests', () => {
  it('puts them on the card that links them, and on no other', () => {
    const state: PlanState = {
      items: [card('a', 1, {}), card('b', 2, {})],
      plan: { boards: [], statuses: [], types: TYPES } as unknown as PlanState['plan'],
      pullRequests: [status('acme/web#8', { cards: ['b'] })],
    };
    const listing = planListing(state);
    expect(listing.items[0]).not.toHaveProperty('pullRequests');
    expect(listing.items[1]!.pullRequests).toEqual([
      {
        name: 'acme/web#8',
        state: 'open',
        title: 'Title of acme/web#8',
        url: 'https://github.com/acme/web/pull/8',
      },
    ]);
  });
});
