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

  it('shows no tick, pill or Changed since verified under a Review Period of Never', () => {
    const { container } = render(
      <PageMetaRowView
        trust={pageTrust({ verifiedAt: NOW - 400 * DAY, verifiedBy: 'u1' }, 'never', NOW)}
        now={NOW}
        verifiedBy="Priya Nair"
        changedSinceVerified
      />,
    );
    expect(container.querySelector('[data-page-meta]')!.textContent).toBe('');
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

  // Page Details opens from the Verified panel (folded at first, owner 2026-11-22); with no panel it shows open.
  const openDetails = () => {
    const toggle = screen.queryByRole('button', { name: 'Page Details' });
    if (toggle?.getAttribute('aria-expanded') === 'false') fireEvent.click(toggle);
  };
  const renderRail = (ui: React.ReactElement) => {
    const result = render(ui);
    openDetails();
    return result;
  };

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
    periodControl: (label: string) => (
      <button type="button" aria-label={`Change Review Period: ${label}`}>
        <span data-review-period="">{label}</span>
      </button>
    ),
    ...over,
  });

  it('an Editor changes the owner, verifies again, and has the Review Period as a link', () => {
    const p = props();
    renderRail(<Rail {...p} />);
    fireEvent.change(screen.getByLabelText('Owner'), { target: { value: 'u2' } });
    expect(p.onSetOwner).toHaveBeenCalledWith('u2');
    fireEvent.change(screen.getByLabelText('Owner'), { target: { value: '' } });
    expect(p.onSetOwner).toHaveBeenLastCalledWith(null);
    // The Review Period is the knowledgebase's: the card says it, with the control it is given beside it.
    expect(screen.queryByLabelText('Review Interval')).toBeNull();
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: 'Change Review Period: Every 90 Days' }).textContent,
    ).toBe('Every 90 Days');
    fireEvent.click(screen.getByRole('button', { name: 'Verify Again' }));
    expect(p.onVerify).toHaveBeenCalledTimes(1);
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('1,400')).toBeTruthy();
  });

  // approval.md "Where it shows" (owner 2026-11-21): under Review Period, Request Approval for a page never sent;
  // nothing there once one is asked for (the Approval section holds it).
  it('shows Approval under Review Period: Request Approval, Not Requested, or nothing', () => {
    const onRequest = vi.fn();
    const { rerender } = renderRail(<Rail {...props({ approvalRow: { onRequest } })} />);
    const rows = [...document.querySelectorAll('dt')].map((d) => d.textContent);
    expect(rows.indexOf('Approval')).toBe(rows.indexOf('Review Period') + 1);
    fireEvent.click(screen.getByRole('button', { name: 'Request Approval' }));
    expect(onRequest).toHaveBeenCalledTimes(1);
    rerender(<Rail {...props({ approvalRow: { onRequest: undefined } })} />);
    expect(screen.queryByRole('button', { name: 'Request Approval' })).toBeNull();
    expect(screen.getByText('Not Requested')).toBeTruthy();
    rerender(<Rail {...props()} />);
    expect(screen.queryByText('Approval')).toBeNull();
  });

  it.each(['Participant', 'Viewer'])('a %s reads the card and changes nothing', () => {
    renderRail(
      <Rail
        {...props({
          onSetOwner: undefined,
          onVerify: undefined,
          periodControl: undefined,
        })}
      />,
    );
    expect(screen.queryByRole('combobox')).toBeNull();
    // Only the fold of Page Details: nothing that changes the page.
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Page Details',
    ]);
    expect(screen.getByText('Priya Nair')).toBeTruthy();
    expect(screen.getByText('Every 90 Days')).toBeTruthy();
    expect(screen.getByLabelText('Verified by Priya Nair')).toBeTruthy();
  });

  // One line (owner 2026-11-21): the date, then the verifier's disc, its name whole on hover and to a screen reader.
  it('shows when it was last verified on one line, and who by their disc, named in full', () => {
    const long = 'Priyamvada Nair-Oyelaran of Platform Reliability';
    const { container } = renderRail(
      <Rail {...props({ nameOf: (id) => (id ? long : undefined) })} />,
    );
    const date = container.querySelector('[data-verified-date]')!;
    const by = container.querySelector('[data-verified-by]')!;
    expect(date.textContent).not.toBe('');
    expect(by.getAttribute('aria-label')).toBe(`Verified by ${long}`);
    expect(date.parentElement!.className).toContain('whitespace-nowrap');
  });

  it('keeps every row while the reads load, and names a page never verified', () => {
    const { container } = renderRail(<Rail {...props({ trust: never, reads: undefined })} />);
    expect(container.querySelectorAll('dt')).toHaveLength(4);
    expect(container.querySelector('[data-review-due]')!.textContent).toBe('Not Verified');
    // Reads not in yet count as none, never a dash.
    expect(screen.queryByText('–')).toBeNull();
    expect(screen.getByText('by People').parentElement!.textContent).toBe('0 by People');
    expect(screen.getByText('by Agents').parentElement!.textContent).toBe('0 by Agents');
    expect(screen.getByText('Never', { selector: 'dd' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Verify' })).toBeTruthy();
  });

  it('says when the review is due under the knowledgebase’s period, and draws no verification under Never', () => {
    const dueOf = (over: Partial<RailProps>) => {
      const { container, unmount } = renderRail(<Rail {...props(over)} />);
      const shown = [
        container.querySelector('[data-review-due]')?.textContent ?? null,
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
    // The same rows whatever period is set: nothing in the card moves when it changes.
    expect(new Set([dueOf({}).rows, yearly.rows])).toEqual(new Set([4]));
    // Never (verification.md "Under a Review Period of Never"): Last Verified and Review Due go; Owner and the Review
    // Period, reading Never, stay so the period can be set again from here.
    const never = dueOf({ trust: pageTrust(fields, 'never', NOW), reviewEvery: 'never' });
    expect(never.shown).toEqual([null, 'Never']);
    expect(never.rows).toBe(2);
  });

  it.each([
    ['an Editor', true],
    ['a Participant', false],
    ['a Viewer', false],
  ] as const)(
    'under Never, %s sees no state, no Last Verified, no Review Due and no Verify',
    (_who, edits) => {
      const fields = { verifiedAt: NOW - 10 * DAY, verifiedBy: 'u1', owner: 'u1' };
      const { container } = renderRail(
        <Rail
          {...props({
            trust: pageTrust(fields, 'never', NOW),
            reviewEvery: 'never',
            ...(edits ? {} : { onSetOwner: undefined, periodControl: undefined }),
          })}
        />,
      );
      expect(container.querySelector('[data-page-state]')).toBeNull();
      const rows = [...container.querySelectorAll('dt')].map((d) => d.textContent);
      expect(rows).not.toContain('Last Verified');
      expect(rows).not.toContain('Review Due');
      expect(rows).toContain('Owner');
      expect(rows).toContain('Review Period');
      expect(screen.queryByRole('button', { name: /^Verify/ })).toBeNull();
      expect(screen.queryByText(/Verified|Not Verified/)).toBeNull();
      // Set a period again and the same stored date shows, with its state.
      cleanup();
      const back = renderRail(<Rail {...props({ trust: pageTrust(fields, 90, NOW) })} />);
      expect(
        back.container.querySelector('[data-page-state]')!.getAttribute('data-page-state'),
      ).toBe('verified');
      expect(back.container.querySelector('[data-review-due]')).not.toBeNull();
    },
  );

  it('keeps an owner it cannot name as the chosen one', () => {
    renderRail(<Rail {...props({ trust: pageTrust({ owner: 'u9' }, 90, NOW) })} />);
    expect(screen.getByLabelText<HTMLSelectElement>('Owner').value).toBe('u9');
    expect(screen.getByRole('option', { name: 'Someone Else' })).toBeTruthy();
  });

  it('leads with the state and how long the page stays fresh, its ring filled by the share of the period left', () => {
    const { container } = renderRail(<Rail {...props()} />);
    const state = container.querySelector('[data-page-state]')!;
    expect(state.getAttribute('data-page-state')).toBe('verified');
    expect(state.querySelector('p')!.textContent).toBe('Verified');
    expect(state.textContent).toContain('Fresh for 80 more days');
    // Its `?` opens the help article on verifying, in a new tab.
    const help = state.querySelector('a[target="_blank"]')!;
    expect(help.getAttribute('href')).toContain('owners-and-verifying');
    expect(freshness(verified, 90, NOW)).toBeCloseTo(80 / 90);
    expect(container.querySelector('[data-freshness-arc]')).toBeTruthy();
    expect(healthHeadline(pageTrust({}, 90, NOW), 90, NOW).title).toBe('Not Verified');
    expect(freshness(pageTrust({}, 90, NOW), 90, NOW)).toBeUndefined();
    const due = pageTrust({ verifiedAt: NOW - 100 * DAY, verifiedBy: 'u1' }, 90, NOW);
    expect(healthHeadline(due, 90, NOW).title).toBe('Review Due');
    expect(freshness(due, 90, NOW)).toBe(0);
    expect(healthHeadline(verified, 'never', NOW).line).toBe('No review needed');
    // Just verified, read by a clock a few seconds behind: the whole period, never a day more.
    const justNow = pageTrust({ verifiedAt: NOW, verifiedBy: 'u1' }, 90, NOW);
    expect(healthHeadline(justNow, 90, NOW - 30_000).line).toBe('Fresh for 90 more days');
  });

  it('says who created the page and who last updated it, at its foot, and nothing when unknown', () => {
    const { container, rerender } = renderRail(
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
