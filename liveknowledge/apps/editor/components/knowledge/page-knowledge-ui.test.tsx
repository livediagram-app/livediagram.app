// @vitest-environment jsdom

// The page's verification UI (docs/specs/030-knowledgebase/verification.md): the meta row, the Page Health card,
// On This Page and the badge, each from plain props, a share role at a time.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { contrastRatio } from '@liveknowledge/document';
import { pageTrust } from '@/lib/knowledge/page-trust';
import { OnThisPage } from './OnThisPage';
import {
  PageHealthCard,
  freshness,
  healthHeadline,
  PageActivity,
  type PageActivityProps,
  type PageHealthCardProps,
} from './PageHealthCard';
import { PageMetaRowView } from './PageMetaRow';
import { REVIEW_DUE_PILL, TrustBadge, VERIFIED_PILL } from './TrustBadge';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 20, 12);
const verified = pageTrust({ verifiedAt: NOW - 10 * DAY, verifiedBy: 'u1', owner: 'u1' }, 90, NOW);
const due = pageTrust({ verifiedAt: NOW - 100 * DAY, verifiedBy: 'u1' }, 90, NOW);
const never = pageTrust(undefined, 90, NOW);

afterEach(cleanup);

describe('the meta row', () => {
  it('shows the tick with the verifier, and when the review is due', () => {
    render(
      <PageMetaRowView
        trust={verified}
        now={NOW}
        verifiedBy="Priya Nair"
        changedSinceVerified={false}
      />,
    );
    expect(screen.getByText('Verified by Priya Nair')).toBeTruthy();
    expect(screen.getByText(/^Review due /)).toBeTruthy();
    expect(screen.queryByText('Changed since verified')).toBeNull();
  });

  it('shows the amber pill once the review has passed, and Changed since verified', () => {
    render(
      <PageMetaRowView
        trust={due}
        now={NOW}
        verifiedBy={undefined}
        changedSinceVerified
        edited={{ at: NOW - 2 * DAY, by: 'Marcus Oyelaran' }}
      />,
    );
    expect(screen.getByText('Review Due')).toBeTruthy();
    expect(screen.getByText(/^Review was due /)).toBeTruthy();
    expect(screen.getByText('Changed since verified')).toBeTruthy();
    expect(screen.getByText(/^Edited .* by Marcus Oyelaran$/)).toBeTruthy();
  });

  it('shows nothing for a page never verified, and keeps its height', () => {
    const { container } = render(
      <PageMetaRowView
        trust={never}
        now={NOW}
        verifiedBy={undefined}
        changedSinceVerified={false}
      />,
    );
    const row = container.querySelector('[data-page-meta]')!;
    expect(row.textContent).toBe('');
    // Nothing to say: no row, so the writing sits right under the title.
    expect(row.className.split(' ')).toContain('hidden');
  });

  it('says how long the page takes to read, with a clock, and nothing for an empty page', () => {
    const never = pageTrust({}, 90, NOW);
    const { container, rerender } = render(
      <PageMetaRowView
        minutes={4}
        trust={never}
        now={NOW}
        verifiedBy={undefined}
        changedSinceVerified={false}
      />,
    );
    const read = container.querySelector('[data-reading-time]')!;
    expect(read.textContent).toBe('4 min read');
    expect(read.querySelector('svg')).toBeTruthy();
    expect(container.querySelector('[data-page-meta]')!.className.split(' ')).not.toContain(
      'hidden',
    );
    rerender(
      <PageMetaRowView
        minutes={0}
        trust={never}
        now={NOW}
        verifiedBy={undefined}
        changedSinceVerified={false}
      />,
    );
    expect(container.querySelector('[data-reading-time]')).toBeNull();
  });

  it("holds no Verify button: verifying is the right rail's", () => {
    render(
      <PageMetaRowView
        trust={never}
        now={NOW}
        verifiedBy={undefined}
        changedSinceVerified={false}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('Page Health', () => {
  // The rail as docked: Page Health, then the foot with the week's reads and who made and updated the page.
  type RailProps = PageHealthCardProps & PageActivityProps;
  const Rail = (p: RailProps) => (
    <>
      <PageHealthCard {...p} />
      <PageActivity now={p.now} reads={p.reads} created={p.created} updated={p.updated} />
    </>
  );

  const props = (over: Partial<RailProps> = {}): RailProps => ({
    trust: verified,
    reviewEvery: 90,
    now: NOW,
    reads: { people: 12, agents: 1400 },
    people: [
      { id: 'u1', name: 'Priya Nair' },
      { id: 'u2', name: 'Marcus Oyelaran' },
    ],
    nameOf: (id) => ({ u1: 'Priya Nair', u2: 'Marcus Oyelaran' })[id ?? ''],
    onSetOwner: vi.fn(),
    onVerify: vi.fn(),
    ...over,
  });

  it('an Editor changes the owner, verifies again, and is linked to the Review Period, with no control of its own', () => {
    const p = props();
    render(<Rail {...p} />);
    fireEvent.change(screen.getByLabelText('Owner'), { target: { value: 'u2' } });
    expect(p.onSetOwner).toHaveBeenCalledWith('u2');
    fireEvent.change(screen.getByLabelText('Owner'), { target: { value: '' } });
    expect(p.onSetOwner).toHaveBeenLastCalledWith(null);
    // The Review Period is the knowledgebase's: the card says it and links to the setting.
    expect(screen.queryByLabelText('Review Interval')).toBeNull();
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
    // The period is shown, with no way to change it here: it is changed in Knowledgebase Settings.
    expect(screen.getByText('Every 90 Days').closest('dd')!.textContent).toBe('Every 90 Days');
    expect(screen.queryByRole('button', { name: 'Change the Review Period' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Verify Again' }));
    expect(p.onVerify).toHaveBeenCalledTimes(1);
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('1,400')).toBeTruthy();
  });

  it.each(['Participant', 'Viewer'])('a %s reads the card and changes nothing', () => {
    render(
      <Rail
        {...props({
          onSetOwner: undefined,
          onVerify: undefined,
        })}
      />,
    );
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Priya Nair')).toBeTruthy();
    expect(screen.getByText('Every 90 Days')).toBeTruthy();
    expect(screen.getByText(/by Priya Nair$/)).toBeTruthy();
  });

  // "Nov 20 by Priya N…": the value was one truncated line. The date and the name are each whole now, the name on
  // a line of its own when the card is too narrow for both.
  it('shows when it was last verified and by whom, each in full, never cut short', () => {
    const long = 'Priyamvada Nair-Oyelaran of Platform Reliability';
    const { container } = render(<Rail {...props({ nameOf: (id) => (id ? long : undefined) })} />);
    const date = container.querySelector('[data-verified-date]')!;
    const by = container.querySelector('[data-verified-by]')!;
    expect(by.textContent).toBe(`by ${long}`);
    expect(date.textContent).not.toBe('');
    const value = date.closest('dd')!;
    // No ellipsis on the value or on either part, and each part is a block, so the name wraps under the date.
    for (const el of [value, date, by]) expect(el.className).not.toMatch(/\btruncate\b|line-clamp/);
    expect(date.className).toContain('block');
    expect(by.className).toContain('block');
    expect(value.className).toContain('break-words');
    // The other rows keep one line.
    expect(screen.getByText('12').closest('dd')!.className).toContain('truncate');
  });

  it('keeps every row while the reads load, and names a page never verified', () => {
    const { container } = render(<Rail {...props({ trust: never, reads: undefined })} />);
    expect(container.querySelectorAll('dt')).toHaveLength(6);
    expect(container.querySelector('[data-review-due]')!.textContent).toBe('Not Verified');
    // Reads not in yet count as none, never a dash.
    expect(screen.queryByText('–')).toBeNull();
    expect(screen.getByText('People').parentElement!.textContent).toBe('0 People');
    expect(screen.getByText('Agents').parentElement!.textContent).toBe('0 Agents');
    expect(screen.getByText('Never', { selector: 'dd' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Verify' })).toBeTruthy();
  });

  it('says when the review is due under the knowledgebase’s period, and No Review Period under Never', () => {
    const dueOf = (over: Partial<RailProps>) => {
      const { container, unmount } = render(<Rail {...props(over)} />);
      const shown = [
        container.querySelector('[data-review-due]')!.textContent,
        container.querySelector('[data-review-period]')!.textContent,
      ];
      const rows = container.querySelectorAll('dt').length;
      unmount();
      return { shown, rows };
    };
    const fields = { verifiedAt: NOW - 10 * DAY, verifiedBy: 'u1', owner: 'u1' };
    const at = (days: number) =>
      new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
        .format(NOW - 10 * DAY + days * DAY)
        .replace(/,? 2026$/, '');
    expect(dueOf({}).shown[1]).toBe('Every 90 Days');
    expect(dueOf({}).shown[0]).toContain(at(90).split(' ')[0]);
    const yearly = dueOf({ trust: pageTrust(fields, 365, NOW), reviewEvery: 365 });
    expect(yearly.shown).toEqual([expect.stringContaining('2027'), 'Every Year']);
    const never = dueOf({ trust: pageTrust(fields, 'never', NOW), reviewEvery: 'never' });
    expect(never.shown).toEqual(['No Review Period', 'Never']);
    // The same rows whatever the period: nothing in the card moves when it changes.
    expect(new Set([dueOf({}).rows, yearly.rows, never.rows])).toEqual(new Set([6]));
  });

  it('keeps an owner it cannot name as the chosen one', () => {
    render(<Rail {...props({ trust: pageTrust({ owner: 'u9' }, 90, NOW) })} />);
    expect(screen.getByLabelText<HTMLSelectElement>('Owner').value).toBe('u9');
    expect(screen.getByRole('option', { name: 'Someone Else' })).toBeTruthy();
  });

  it('leads with the state and how long the page stays fresh, its ring filled by the share of the period left', () => {
    const { container } = render(<Rail {...props()} />);
    const state = container.querySelector('[data-page-state]')!;
    expect(state.getAttribute('data-page-state')).toBe('verified');
    expect(state.textContent).toBe('VerifiedFresh for 80 more days');
    expect(freshness(verified, 90, NOW)).toBeCloseTo(80 / 90);
    expect(container.querySelector('[data-freshness-arc]')).toBeTruthy();
    expect(healthHeadline(pageTrust({}, 90, NOW), 90, NOW).title).toBe('Not Verified');
    expect(freshness(pageTrust({}, 90, NOW), 90, NOW)).toBeUndefined();
    const due = pageTrust({ verifiedAt: NOW - 100 * DAY, verifiedBy: 'u1' }, 90, NOW);
    expect(healthHeadline(due, 90, NOW).title).toBe('Review Due');
    expect(freshness(due, 90, NOW)).toBe(0);
    expect(healthHeadline(verified, 'never', NOW).line).toBe('No review needed');
  });

  it('says who created the page and who last updated it, at its foot, and nothing when unknown', () => {
    const { container, rerender } = render(
      <Rail
        {...props({
          created: { at: NOW - 3 * DAY, by: 'Priya Nair' },
          updated: { at: NOW - 3 * 60_000, by: undefined },
        })}
      />,
    );
    const rows = [...container.querySelectorAll('[data-page-stamp]')].map((r) => r.textContent);
    expect(rows[0]).toMatch(/^PNPriya NairCreated 3 days ago/);
    // A guest's disc is the theme's person glyph, never a "G".
    expect(rows[1]).toMatch(/^GuestUpdated 3 mins ago/);
    rerender(<Rail {...props()} />);
    expect(container.querySelectorAll('[data-page-stamp]')).toHaveLength(0);
  });
});

describe('On This Page', () => {
  const headings = [
    { id: 'a', level: 1 as const, text: 'Before You Start' },
    { id: 'c', level: 2 as const, text: 'Tag the Build' },
  ];

  it('marks the current heading and goes to the one pressed', () => {
    const onGo = vi.fn();
    render(<OnThisPage headings={headings} current="c" onGo={onGo} />);
    expect(screen.getByRole('navigation', { name: 'On This Page' })).toBeTruthy();
    const here = screen.getByRole('button', { name: 'Tag the Build' });
    expect(here.getAttribute('aria-current')).toBe('location');
    expect(here.className).toContain('border-brand-600');
    const other = screen.getByRole('button', { name: 'Before You Start' });
    expect(other.getAttribute('aria-current')).toBeNull();
    fireEvent.click(other);
    expect(onGo).toHaveBeenCalledWith('a');
  });

  it('is absent for a page with no headings', () => {
    const { container } = render(<OnThisPage headings={[]} current={undefined} onGo={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('the badge', () => {
  it('names itself in a tree row, where it is a tick or a short pill', () => {
    render(
      <>
        <TrustBadge mark="verified" compact />
        <TrustBadge mark="review-due" compact />
      </>,
    );
    expect(screen.getByRole('img', { name: 'Verified' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Review Due' }).textContent).toBe('Due');
  });

  it('is over 4.5:1 in both pills', () => {
    const theme = readFileSync(resolve('../../packages/tailwind-config/theme.css'), 'utf8');
    const brand = (step: number) =>
      new RegExp(`--color-brand-${step}:\\s*(#[0-9a-fA-F]{6})`).exec(theme)![1]!;
    expect(VERIFIED_PILL).toContain('bg-brand-100 text-brand-900');
    expect(contrastRatio(brand(900), brand(100))).toBeGreaterThan(4.5);
    // Tailwind's amber-800 on amber-100.
    expect(REVIEW_DUE_PILL).toContain('bg-amber-100 text-amber-800');
    expect(contrastRatio('#92400e', '#fef3c7')).toBeGreaterThan(4.5);
  });
});
