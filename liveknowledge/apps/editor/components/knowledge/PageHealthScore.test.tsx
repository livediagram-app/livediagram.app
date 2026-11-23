// @vitest-environment jsdom

// The Health Score in Page Health (docs/specs/030-knowledgebase/verification.md "In Page Health"): the figure, its
// word and reason, the breakdown closed by default, each fix a button only for whoever may make it; the facts the
// editor reads, and the score's chip where Insights and Ask draw it.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pageHealth, type PageHealthFacts } from '@liveknowledge/knowledge';
import type { ArticleBlock } from '@liveknowledge/document';
import { pageTrust } from '@/lib/knowledge/page-trust';
import { pageHealthFacts, pageShapeOf, sameShape } from '@/lib/knowledge/page-health-facts';
import { PageHealthScore } from './PageHealthScore';
import { HealthChip } from './HealthChip';
import { HealthSection } from '@/components/insights/HealthAndContext';
import { ConflictRow } from '@/components/insights/ConflictRow';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 21, 12);

afterEach(cleanup);

const facts = (over: Partial<PageHealthFacts> = {}): PageHealthFacts => ({
  state: 'never-verified',
  reviewDays: 90,
  owned: false,
  band: 'medium',
  headings: 0,
  brokenLinks: 1,
  backlinks: 0,
  pendingApproval: false,
  reads: 2,
  updatedAt: NOW,
  ...over,
});

describe('the score at the top of Page Health', () => {
  it('shows the figure, the word and the reason, the breakdown closed', () => {
    render(<PageHealthScore health={pageHealth(facts(), NOW)} fixes={{}} />);
    // The whole score is the breakdown's toggle, its name the score said in words.
    const toggle = screen.getByRole('button', {
      name: /^Health Score \d+ of 100, Needs Work: Never verified\. Score Breakdown$/,
    });
    expect(toggle.textContent).toContain('Needs Work');
    expect(screen.getByText('Never verified')).toBeTruthy();
    expect(screen.queryByText('Health Score')).toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('list', { name: 'Score Breakdown' })).toBeNull();
  });

  it('opens to each factor with its points and what would raise it', () => {
    render(<PageHealthScore health={pageHealth(facts(), NOW)} fixes={{}} />);
    fireEvent.click(screen.getByRole('button', { name: /Score Breakdown$/ }));
    const list = screen.getByRole('list', { name: 'Score Breakdown' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(8);
    expect(within(list).getByText('Verify this page: +30')).toBeTruthy();
    expect(within(list).getByText('Fix 1 broken link: +2')).toBeTruthy();
    // A Viewer: no fixes offered, only the words.
    expect(within(list).queryAllByRole('button')).toHaveLength(0);
  });

  it('offers each fix as a button only where the person may make it', () => {
    const verify = vi.fn();
    const owner = vi.fn();
    const heading = vi.fn();
    const { rerender } = render(
      <PageHealthScore health={pageHealth(facts(), NOW)} fixes={{ verify, owner, heading }} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Score Breakdown$/ }));
    const list = screen.getByRole('list', { name: 'Score Breakdown' });
    // Verification and Freshness both offer Verify.
    const verifies = within(list).getAllByRole('button', { name: 'Verify' });
    expect(verifies).toHaveLength(2);
    fireEvent.click(verifies[0]!);
    fireEvent.click(within(list).getByRole('button', { name: 'Set an Owner' }));
    fireEvent.click(within(list).getByRole('button', { name: 'Add a Heading' }));
    expect([verify, owner, heading].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
    // A Participant who may verify but not write: no Add a Heading.
    rerender(<PageHealthScore health={pageHealth(facts(), NOW)} fixes={{ verify }} />);
    expect(screen.queryByRole('button', { name: 'Add a Heading' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Set an Owner' })).toBeNull();
  });

  it('under a Review Period of Never shows no verification factor and no Verify', () => {
    const health = pageHealth(facts({ reviewDays: undefined }), NOW);
    render(<PageHealthScore health={health} fixes={{ verify: vi.fn() }} />);
    fireEvent.click(screen.getByRole('button', { name: /Score Breakdown$/ }));
    expect(screen.queryByText('Verification')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Verify' })).toBeNull();
  });

  it('says what it leaves out for a knowledgebase kept Offline', () => {
    render(<PageHealthScore health={pageHealth(facts(), NOW)} fixes={{}} offline />);
    fireEvent.click(screen.getByRole('button', { name: /Score Breakdown$/ }));
    expect(
      screen.getByText('Kept in this browser: reads and open issues are not counted.'),
    ).toBeTruthy();
  });

  it('a healthy page reads as Healthy, its word drawn and every check passing', () => {
    const health = pageHealth(
      facts({
        state: 'verified',
        verifiedAt: NOW,
        reviewAt: NOW + 90 * DAY,
        owned: true,
        headings: 2,
        brokenLinks: 0,
        backlinks: 1,
      }),
      NOW,
    );
    const { container } = render(<PageHealthScore health={health} fixes={{}} />);
    expect(container.querySelector('[data-health-score="healthy"]')).toBeTruthy();
    expect(screen.getByText('Every check passes')).toBeTruthy();
  });
});

describe('the facts the editor reads', () => {
  const para = (id: string, text: string, style = 'body') =>
    ({ id, type: 'paragraph', style, runs: [{ text }] }) as unknown as ArticleBlock;
  const link = (id: string, page: string) =>
    ({ id, type: 'paragraph', runs: [{ text: 'see', page }] }) as unknown as ArticleBlock;

  it('reads the band, the headings and links to pages no longer here, kept per list', () => {
    const blocks = [
      para('a', 'Title', 'title'),
      para('h', 'Steps', 'h2'),
      link('l', 'gone'),
      link('m', 'p2'),
    ];
    const tabs = [{ id: 'p1' }, { id: 'p2' }];
    const shape = pageShapeOf(blocks, tabs);
    expect(shape).toEqual({ band: 'few', headings: 1, brokenLinks: 1 });
    expect(pageShapeOf(blocks, tabs)).toEqual(shape);
    expect(pageShapeOf(undefined, tabs)).toEqual({ band: 'empty', headings: 0, brokenLinks: 0 });
    expect(sameShape(shape, { ...shape })).toBe(true);
    expect(sameShape(shape, { ...shape, band: 'short' })).toBe(false);
  });

  it('takes Page Health’s counts once read, and leaves them out before', () => {
    const trust = pageTrust({ owner: 'u1', approval: undefined }, 90, NOW);
    const shape = { band: 'brief' as const, headings: 0, brokenLinks: 0 };
    expect(pageHealthFacts(trust, 90, shape, undefined)).toMatchObject({
      owned: true,
      reviewDays: 90,
      backlinks: undefined,
      reads: undefined,
    });
    const read = {
      knowledge: {
        tab: 'p',
        state: 'never-verified' as const,
        changedSinceVerified: false,
        tokens: 0,
      },
      reads: { people: 1, agents: 2 },
      created: { by: 'u1', at: 5, kind: 'human' as const },
      updated: { by: 'u1', at: 9, kind: 'human' as const },
      signals: { openConflicts: 1, openThreads: 2, suggestions: 3, backlinks: 4 },
    };
    expect(pageHealthFacts(trust, 'never', shape, read)).toMatchObject({
      reviewDays: undefined,
      reads: 3,
      createdAt: 5,
      updatedAt: 9,
      openConflicts: 1,
      openThreads: 2,
      suggestions: 3,
      backlinks: 4,
    });
  });
});

describe('the facts under a Review Period of Never', () => {
  it('score from the stored state, though no state shows', () => {
    const shape = { band: 'brief' as const, headings: 0, brokenLinks: 0 };
    const off = pageTrust({ verifiedAt: NOW - 400 * 86_400_000 }, 'never', NOW);
    expect(off.state).toBe('off');
    expect(pageHealthFacts(off, 'never', shape, undefined).state).toBe('verified');
    const unverified = pageTrust(undefined, 'never', NOW);
    expect(pageHealthFacts(unverified, 'never', shape, undefined).state).toBe('never-verified');
  });
});

describe('the score elsewhere', () => {
  it('a chip says the figure and the word', () => {
    render(<HealthChip score={42} label="needs-work" prefix />);
    expect(screen.getByText('Health 42,').parentElement!.textContent).toBe('Health 42, Needs Work');
  });

  const counts = { verified: 1, reviewDue: 0, neverVerified: 2, total: 3, average: 60 };
  const section = (
    lowHealth: Parameters<typeof HealthSection>[0]['lowHealth'],
    onOpenPage = vi.fn(),
  ) =>
    render(
      <HealthSection
        health={counts}
        lowHealth={lowHealth}
        onOpenPage={onOpenPage}
        canRemind={false}
        remindedAt={undefined}
        reminding={false}
        now={NOW}
        onRemind={vi.fn()}
      />,
    );

  it('Knowledge Health lists the pages with low health, each opening its page, and the average', () => {
    const open = vi.fn();
    section(
      [
        { tab: 'h', title: 'Holidays', score: 38, label: 'needs-work', reason: 'Never verified' },
        { tab: 'r', title: 'Rollbacks', score: 60, label: 'fair', reason: '2 broken links' },
      ],
      open,
    );
    expect(screen.getByText('Pages With Low Health')).toBeTruthy();
    expect(document.querySelector('[data-health-average]')!.textContent).toBe('Average health 60');
    fireEvent.click(screen.getByRole('button', { name: /Holidays/ }));
    expect(open).toHaveBeenCalledWith('h');
    expect(screen.getByText('2 broken links')).toBeTruthy();
  });

  it('under a Review Period of Never leads with the average, with no verified share, bar or Remind', () => {
    render(
      <HealthSection
        health={{ verified: 0, reviewDue: 2, neverVerified: 1, total: 3, average: 71 }}
        lowHealth={[]}
        onOpenPage={vi.fn()}
        canRemind
        remindedAt={undefined}
        reminding={false}
        now={NOW}
        onRemind={vi.fn()}
        verificationOn={false}
      />,
    );
    expect(document.querySelector('[data-health-average]')!.textContent).toBe(
      '71average health across 3 pages',
    );
    expect(screen.queryByRole('button', { name: /Remind/ })).toBeNull();
    expect(screen.queryByText(/verified/i)).toBeNull();
    expect(screen.getByText('Every Page Is Healthy')).toBeTruthy();
  });

  it('says every page is healthy when none is low, and draws nothing from an older api', () => {
    section([]);
    expect(screen.getByText('Every Page Is Healthy')).toBeTruthy();
    cleanup();
    section(undefined);
    expect(screen.queryByText('Pages With Low Health')).toBeNull();
  });

  const side = (tab: string, score?: number) => ({
    passageId: `p-${tab}`,
    tab,
    firstBlock: 'b1',
    title: tab === 'a' ? 'Deploys' : 'Old Deploys',
    text: 'We deploy on Tuesdays.',
    trust: 'verified' as const,
    ...(score === undefined
      ? {}
      : { health: { score, label: score >= 75 ? ('healthy' as const) : ('needs-work' as const) } }),
  });
  const conflict = (a?: number, b?: number) => ({
    id: 'c1',
    question: 'When do we deploy?',
    a: side('a', a),
    b: side('b', b),
    foundAt: 1,
  });
  const row = (c: ReturnType<typeof conflict>, open = vi.fn()) =>
    render(
      <ConflictRow
        conflict={c}
        canResolve
        canAskOwners={false}
        busy={new Set()}
        now={NOW}
        onOpenPage={open}
        onDismiss={vi.fn()}
        onAskOwners={vi.fn()}
      />,
    );

  it('a conflict side says nothing of verification where it is off', () => {
    const c = conflict(41, 86);
    row({ ...c, a: { ...c.a, trust: 'off' as never }, b: { ...c.b, trust: 'off' as never } });
    expect(screen.queryByText(/Verified/)).toBeNull();
    expect(screen.getAllByText(/Health/).length).toBeGreaterThan(0);
  });

  it('a conflict suggests the healthier page as the likelier right, leading with it', () => {
    const open = vi.fn();
    row(conflict(41, 86), open);
    expect(document.querySelector('[data-likelier-right="b"]')!.textContent).toBe(
      'Old Deploys is more likely right (health 86 against 41)',
    );
    const buttons = screen.getAllByRole('button', { name: /Is Right, Fix the Other/ });
    expect(buttons[0]!.textContent).toBe('Old Deploys Is Right, Fix the Other');
    fireEvent.click(buttons[0]!);
    expect(open).toHaveBeenCalledWith('a', 'b1');
    expect(screen.getAllByText(/^Health \d+,$/)).toHaveLength(2);
  });

  it('suggests neither when the two are within 10, or not scored', () => {
    row(conflict(80, 75));
    expect(document.querySelector('[data-likelier-right]')).toBeNull();
    expect(screen.getAllByRole('button', { name: /Is Right/ })[0]!.textContent).toBe(
      'Deploys Is Right, Fix the Other',
    );
    cleanup();
    row(conflict(90, undefined));
    expect(document.querySelector('[data-likelier-right]')).toBeNull();
    cleanup();
    row(conflict(90, 40));
    expect(document.querySelector('[data-likelier-right="a"]')).toBeTruthy();
  });
});
