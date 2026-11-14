// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ITEM_TYPES,
  NO_PULL_REQUEST_STATUSES,
  pullRequestStatuses,
  type CustomFieldDef,
  type Item,
  type ItemTypeDef,
  type PullRequestStatus,
  type PullRequestStatuses,
} from '@liveplanner/items';
import { CardPullRequests } from './CardPullRequests';
import { CustomFieldEditor } from './CustomFieldEditor';
import { PlanCardFace } from './PlanCardFace';
import { PullRequestStoreContext } from './pull-request-store';
import { useValueStore } from './value-store';
import { planPalette } from './plan-palette';
import { contrastRatio } from '@liveplanner/project';
import { CHECKS_TONES_DARK, PullRequestChip, checksInk, pullRequestWords } from './PullRequestPill';

// Pull request state on cards (docs/specs/026-plan/github-pull-requests.md "Pull request state on cards"): the face's
// pill and marks, the panel's chip and title under the field, and its Pull Requests list.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
afterEach(cleanup);

const PR: CustomFieldDef = { id: 'f-pr', label: 'Pull Request', kind: 'pullrequest' };
const LINK: CustomFieldDef = { id: 'f-link', label: 'Link', kind: 'link' };
const by = { id: 'p', name: 'Sam', color: '#000000' };
const task: ItemTypeDef = {
  ...ITEM_TYPES[0],
  id: 'task',
  fields: ['title', 'status', 'f-pr', 'f-link'],
  custom: [PR, LINK],
  display: { detailed: { body: ['f-pr'] } },
};
const card = (fields: Record<string, unknown> = {}): Item => ({
  id: 'c',
  type: 'task',
  key: 1,
  rank: 'i',
  fields: { title: 'Ship it', ...fields },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: by,
  updatedBy: by,
});
const status = (n: number, o: Partial<PullRequestStatus> = {}): PullRequestStatus => ({
  key: `acme/web#${n}`,
  url: `https://github.com/acme/web/pull/${n}`,
  title: `Fix the thing ${n}`,
  state: 'open',
  updatedAt: 1,
  ...o,
});

let setStatuses: (s: PullRequestStatuses) => void = () => undefined;
// The plan's states as PlanProvider holds them, changed by a test as a delivery would.
function Holder({ initial, children }: { initial: PullRequestStatuses; children: ReactNode }) {
  const [value, set] = useState(initial);
  useEffect(() => {
    setStatuses = set;
  }, []);
  const store = useValueStore(value);
  return (
    <PullRequestStoreContext.Provider value={store}>{children}</PullRequestStoreContext.Provider>
  );
}

const face = (item: Item, statuses: PullRequestStatuses = NO_PULL_REQUEST_STATUSES) =>
  render(
    <Holder initial={statuses}>
      <PlanCardFace item={item} palette={planPalette('light')} fields={[]} typeOverride={task} />
    </Holder>,
  );

describe('the card face', () => {
  it.each<[string, Partial<PullRequestStatus>, string]>([
    ['open', {}, 'Open'],
    ['draft', { state: 'draft' }, 'Draft'],
    ['merged', { state: 'merged' }, 'Merged'],
    ['closed', { state: 'closed' }, 'Closed'],
    ['passing', { checks: 'passing' }, 'Checks Passing'],
    ['failing', { checks: 'failing' }, 'Checks Failing'],
    ['running', { checks: 'running' }, 'Checks Running'],
  ])('draws a field’s %s pull request as its state’s pill', (_, o, words) => {
    face(
      card({ 'f-pr': 'https://github.com/acme/web/pull/42' }),
      pullRequestStatuses([status(42, o)]),
    );
    expect(screen.getByText(`Pull Request: acme/web#42: ${words}`)).toBeTruthy();
    const pill = document.querySelector('[data-pull-request-pill]')!;
    expect(pill.getAttribute('data-pull-request-pill')).toBe(o.state ?? 'open');
    expect(!!pill.querySelector('[data-checks-mark]')).toBe(!!o.checks);
  });

  it('reads the short name alone while the plan has no state for it', () => {
    face(card({ 'f-pr': 'https://github.com/acme/web/pull/42' }));
    expect(screen.getByText('Pull Request: acme/web#42')).toBeTruthy();
    expect(document.querySelector('[data-pull-request-pill="unknown"]')).toBeTruthy();
  });

  it('marks the ones no pill shows beside the flags, up to 3, and redraws when a state changes', () => {
    const naming = [1, 2, 3, 4].map((n) => status(n, { state: 'merged', cards: ['c'] }));
    face(
      card({ 'f-link': 'https://github.com/acme/web/pull/9' }),
      pullRequestStatuses([status(9, { state: 'closed' }), ...naming]),
    );
    // The Link field is off the Display: its pull request is a mark too, first.
    const flags = [...document.querySelectorAll('[data-pull-request-flag]')];
    expect(flags.map((f) => f.getAttribute('aria-label'))).toEqual([
      'acme/web#9: Closed',
      'acme/web#1: Merged',
      'acme/web#2: Merged',
    ]);
    act(() => setStatuses(pullRequestStatuses([status(9, { state: 'merged' })])));
    expect(
      [...document.querySelectorAll('[data-pull-request-flag]')].map((f) =>
        f.getAttribute('aria-label'),
      ),
    ).toEqual(['acme/web#9: Merged']);
  });

  // The running dot in dark mode: GitHub's dark amber, unmixed, not the light tone leaned brown toward the ink.
  it('inks each check to read on a light and a dark card, the running one amber in dark', () => {
    const dark = planPalette('dark');
    expect(checksInk('running', dark)).toBe(CHECKS_TONES_DARK.running);
    for (const palette of [planPalette('light'), dark])
      for (const c of ['passing', 'running', 'failing'] as const)
        expect(contrastRatio(checksInk(c, palette), palette.card), c).toBeGreaterThanOrEqual(4.5);
  });

  // Work Tracker 758: on a compact or phone card no tooltip shows, so a mark carries its checks itself.
  it.each<[string, Partial<PullRequestStatus>, string | null, string]>([
    ['open, passing', { checks: 'passing' }, 'passing', 'Checks Passing'],
    ['open, failing', { checks: 'failing' }, 'failing', 'Checks Failing'],
    ['open, running', { checks: 'running' }, 'running', 'Checks Running'],
    ['a draft, failing', { state: 'draft', checks: 'failing' }, 'failing', 'Draft, Checks Failing'],
    ['a draft, no checks', { state: 'draft' }, null, 'Draft'],
    ['open, no checks yet', {}, null, 'Open'],
    ['merged, checks passed', { state: 'merged', checks: 'passing' }, null, 'Merged'],
    ['closed, checks failed', { state: 'closed', checks: 'failing' }, null, 'Closed'],
  ])('a mark for %s shows its checks without a tooltip', (_, o, checks, words) => {
    face(card(), pullRequestStatuses([status(5, { ...o, cards: ['c'] })]));
    const flag = document.querySelector('[data-pull-request-flag]')!;
    expect(flag.getAttribute('aria-label')).toBe(`acme/web#5: ${words}`);
    expect(flag.getAttribute('data-pull-request-checks')).toBe(checks);
    expect(flag.querySelector('[data-checks-mark]')?.getAttribute('data-checks-mark') ?? null).toBe(
      checks,
    );
    // Each check reads by its own shape, not by colour alone: a tick, a cross, a dot.
    if (checks === 'running') expect(flag.querySelector('[data-checks-mark] svg')).toBeNull();
    else if (checks) expect(flag.querySelector('[data-checks-mark] svg')).toBeTruthy();
  });
});

describe('the card panel', () => {
  it('shows the state and title under a Pull Request field, once the plan has one', () => {
    render(
      <Holder initial={pullRequestStatuses([status(42, { state: 'merged' })])}>
        <CustomFieldEditor
          id="f"
          field={PR}
          value="https://github.com/acme/web/pull/42"
          disabled={false}
          onSave={vi.fn()}
        />
      </Holder>,
    );
    const chip = document.querySelector('[data-pull-request-chip]')!;
    expect(chip.textContent).toBe('Merged');
    expect(screen.getByText('Fix the thing 42')).toBeTruthy();
  });

  it('lists under Pull Requests the ones no field holds, each with its state, title and link', () => {
    render(
      <Holder
        initial={pullRequestStatuses([status(42), status(7, { checks: 'failing', cards: ['c'] })])}
      >
        <CardPullRequests
          item={card({ 'f-pr': 'https://github.com/acme/web/pull/42' })}
          type={task}
        />
      </Holder>,
    );
    expect(screen.getByText('Pull Requests')).toBeTruthy();
    const rows = document.querySelectorAll('[data-card-pull-requests] li');
    expect(rows.length).toBe(1);
    expect(rows[0]!.textContent).toContain('acme/web#7');
    expect(rows[0]!.querySelector('[data-pull-request-chip]')!.textContent).toBe('Open·Failing');
    const open = screen.getByRole('link', {
      name: 'Open acme/web#7 on GitHub (opens in a new tab)',
    });
    expect(open.getAttribute('href')).toBe('https://github.com/acme/web/pull/7');
    expect(open.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('draws nothing while every linked pull request is in a field', () => {
    const { container } = render(
      <Holder initial={pullRequestStatuses([status(42)])}>
        <CardPullRequests
          item={card({ 'f-pr': 'https://github.com/acme/web/pull/42' })}
          type={task}
        />
      </Holder>,
    );
    expect(container.textContent).toBe('');
  });

  it('a chip reads each state in words', () => {
    const words = (o: Partial<PullRequestStatus>) => {
      const { container, unmount } = render(<PullRequestChip status={status(1, o)} />);
      const text = container.textContent;
      unmount();
      return text;
    };
    expect(words({})).toBe('Open');
    expect(words({ checks: 'passing' })).toBe('Open·Passing');
    expect(words({ checks: 'running' })).toBe('Open·Running');
    expect(words({ state: 'draft', checks: 'failing' })).toBe('Draft·Failing');
    expect(words({ state: 'closed' })).toBe('Closed');
    expect(pullRequestWords({ owner: 'acme', repo: 'web', number: 1 })).toBe('acme/web#1');
  });
});
