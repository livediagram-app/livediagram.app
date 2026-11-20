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
import { PageHealthCard, type PageHealthCardProps } from './PageHealthCard';
import { PageMetaRowView } from './PageMetaRow';
import { REVIEW_DUE_PILL, TrustBadge, VERIFIED_PILL } from './TrustBadge';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 20, 12);
const verified = pageTrust({ verifiedAt: NOW - 10 * DAY, verifiedBy: 'u1', owner: 'u1' }, NOW);
const due = pageTrust({ verifiedAt: NOW - 100 * DAY, verifiedBy: 'u1' }, NOW);
const never = pageTrust(undefined, NOW);

afterEach(cleanup);

describe('the meta row', () => {
  it('shows the tick with the verifier, and when the review is due', () => {
    render(
      <PageMetaRowView
        trust={verified}
        now={NOW}
        verifiedBy="Priya Nair"
        changedSinceVerified={false}
        onVerify={undefined}
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
        onVerify={undefined}
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
        onVerify={undefined}
      />,
    );
    const row = container.querySelector('[data-page-meta]')!;
    expect(row.textContent).toBe('');
    expect(row.className).toContain('min-h-7');
  });

  it('an Editor verifies in one press; a Participant and a Viewer have no button', () => {
    const onVerify = vi.fn();
    const view = render(
      <PageMetaRowView
        trust={never}
        now={NOW}
        verifiedBy={undefined}
        changedSinceVerified={false}
        onVerify={onVerify}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(onVerify).toHaveBeenCalledTimes(1);
    view.rerender(
      <PageMetaRowView
        trust={never}
        now={NOW}
        verifiedBy={undefined}
        changedSinceVerified={false}
        onVerify={undefined}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('Page Health', () => {
  const props = (over: Partial<PageHealthCardProps> = {}): PageHealthCardProps => ({
    trust: verified,
    now: NOW,
    reads: { people: 12, agents: 1400 },
    people: [
      { id: 'u1', name: 'Priya Nair' },
      { id: 'u2', name: 'Marcus Oyelaran' },
    ],
    nameOf: (id) => ({ u1: 'Priya Nair', u2: 'Marcus Oyelaran' })[id ?? ''],
    onSetOwner: vi.fn(),
    onSetReviewEvery: vi.fn(),
    onVerify: vi.fn(),
    ...over,
  });

  it('an Editor changes the owner and the interval, and verifies again', () => {
    const p = props();
    render(<PageHealthCard {...p} />);
    fireEvent.change(screen.getByLabelText('Owner'), { target: { value: 'u2' } });
    expect(p.onSetOwner).toHaveBeenCalledWith('u2');
    fireEvent.change(screen.getByLabelText('Owner'), { target: { value: '' } });
    expect(p.onSetOwner).toHaveBeenLastCalledWith(null);
    const interval = screen.getByLabelText<HTMLSelectElement>('Review Interval');
    expect([...interval.options].map((o) => o.textContent)).toEqual([
      'Every 30 Days',
      'Every 90 Days',
      'Every 180 Days',
      'Every 365 Days',
      'Never',
    ]);
    expect(interval.value).toBe('90');
    fireEvent.change(interval, { target: { value: 'never' } });
    expect(p.onSetReviewEvery).toHaveBeenCalledWith('never');
    fireEvent.click(screen.getByRole('button', { name: 'Verify Again' }));
    expect(p.onVerify).toHaveBeenCalledTimes(1);
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('1,400')).toBeTruthy();
  });

  it.each(['Participant', 'Viewer'])('a %s reads the card and changes nothing', () => {
    render(
      <PageHealthCard
        {...props({ onSetOwner: undefined, onSetReviewEvery: undefined, onVerify: undefined })}
      />,
    );
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Priya Nair')).toBeTruthy();
    expect(screen.getByText('Every 90 Days')).toBeTruthy();
    expect(screen.getByText(/by Priya Nair$/)).toBeTruthy();
  });

  it('keeps every row while the reads load, and names a page never verified', () => {
    const { container } = render(<PageHealthCard {...props({ trust: never, reads: undefined })} />);
    expect(container.querySelectorAll('dt')).toHaveLength(5);
    expect(screen.getAllByText('–')).toHaveLength(2);
    expect(screen.getByText('Never', { selector: 'dd' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Verify' })).toBeTruthy();
  });

  it('keeps an owner it cannot name as the chosen one', () => {
    render(<PageHealthCard {...props({ trust: pageTrust({ owner: 'u9' }, NOW) })} />);
    expect(screen.getByLabelText<HTMLSelectElement>('Owner').value).toBe('u9');
    expect(screen.getByRole('option', { name: 'Someone Else' })).toBeTruthy();
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
