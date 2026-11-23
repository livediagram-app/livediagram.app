// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TIER_LIMITS } from '@liveworkspace/subscription';
import { UsageMeter } from './UsageMeter';
import { meterState, NEAR_LIMIT, usageWords } from './usage';
import { limitRow } from '@liveworkspace/subscription';

// subscription.md "What people see", "Meters and prompts in each app": a meter that turns amber at the limit.

const FREE_RUNS = TIER_LIMITS.free.automationRunsPerMonth;

describe('UsageMeter', () => {
  it('is a meter named by its label, with the numbers as its value text', () => {
    render(
      <UsageMeter
        limitKey="automationRunsPerMonth"
        used={60}
        limit={FREE_RUNS}
        label="Runs This Month"
      />,
    );
    const meter = screen.getByRole('meter', { name: 'Runs This Month' });
    expect(meter.getAttribute('aria-valuemin')).toBe('0');
    expect(meter.getAttribute('aria-valuemax')).toBe(String(FREE_RUNS));
    expect(meter.getAttribute('aria-valuenow')).toBe('60');
    expect(meter.getAttribute('aria-valuetext')).toBe(`60 of ${FREE_RUNS} this month`);
    expect(screen.getByText(`60 of ${FREE_RUNS} this month`)).toBeTruthy();
  });

  it('plenty left: the app colour, no amber', () => {
    const { container } = render(
      <UsageMeter limitKey="automationRunsPerMonth" used={60} limit={FREE_RUNS} />,
    );
    const box = container.firstElementChild!;
    expect(box.getAttribute('data-usage-meter')).toBe('normal');
    expect(container.querySelector('.bg-amber-500')).toBeNull();
    expect(container.querySelector('.bg-brand-600')).not.toBeNull();
    // The row's own label when none is given.
    expect(screen.getByRole('meter', { name: 'Automation Runs' })).toBeTruthy();
  });

  it(`near from ${NEAR_LIMIT * 100}%: marked, still the app colour`, () => {
    const used = Math.ceil(FREE_RUNS * NEAR_LIMIT);
    const { container } = render(
      <UsageMeter limitKey="automationRunsPerMonth" used={used} limit={FREE_RUNS} />,
    );
    expect(container.firstElementChild!.getAttribute('data-usage-meter')).toBe('near');
    expect(container.querySelector('.bg-amber-500')).toBeNull();
    expect(meterState(used - 1, FREE_RUNS)).toBe('normal');
  });

  it('at the limit: amber bar and numbers, full, and never past its maximum', () => {
    const { container } = render(
      <UsageMeter limitKey="automationRunsPerMonth" used={FREE_RUNS + 5} limit={FREE_RUNS} />,
    );
    expect(container.firstElementChild!.getAttribute('data-usage-meter')).toBe('reached');
    const fill = container.querySelector<HTMLElement>('.bg-amber-500')!;
    expect(fill.style.width).toBe('100%');
    expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe(String(FREE_RUNS));
    expect(
      screen.getByText(usageWords(limitRow('automationRunsPerMonth'), FREE_RUNS + 5, FREE_RUNS))
        .classList,
    ).toContain('text-amber-800');
  });

  it('formats with the row: bytes for storage, and a sliver for a little', () => {
    const { container } = render(
      <UsageMeter
        limitKey="imageStorageBytes"
        used={312_000_000}
        limit={TIER_LIMITS.pro.imageStorageBytes}
      />,
    );
    expect(screen.getByText('312 MB of 50 GB')).toBeTruthy();
    expect(container.querySelector<HTMLElement>('.bg-brand-600')!.style.width).toBe('2%');
  });

  it('unlimited: the count alone, no bar', () => {
    const { container } = render(
      <UsageMeter limitKey="walkthroughsStored" used={3} limit={null} />,
    );
    expect(container.firstElementChild!.getAttribute('data-usage-meter')).toBe('unlimited');
    expect(screen.queryByRole('meter')).toBeNull();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('stacked puts the bar under the label and numbers; auto stacks on a phone only', () => {
    const { container, rerender } = render(
      <UsageMeter limitKey="automationRules" used={6} limit={10} layout="stacked" />,
    );
    expect(container.firstElementChild!.classList).toContain('grid');
    expect(screen.getByRole('meter').classList).toContain('col-span-2');
    rerender(<UsageMeter limitKey="automationRules" used={6} limit={10} />);
    expect(container.firstElementChild!.classList).toContain('grid');
    expect(container.firstElementChild!.classList).toContain('sm:flex');
    rerender(<UsageMeter limitKey="automationRules" used={6} limit={10} layout="inline" />);
    expect(container.firstElementChild!.classList).toContain('flex');
    expect(container.firstElementChild!.classList).not.toContain('grid');
  });

  it('takes the numbers in the caller’s words, where it counts what is left', () => {
    render(
      <UsageMeter
        limitKey="aiCreditsPerMonth"
        used={12}
        limit={50}
        words="38 of 50 left this month"
      />,
    );
    expect(screen.getByText('38 of 50 left this month')).toBeTruthy();
    const meter = screen.getByRole('meter');
    expect(meter.getAttribute('aria-valuetext')).toBe('38 of 50 left this month');
    // The bar still fills as the limit is used.
    expect(meter.getAttribute('aria-valuenow')).toBe('12');
  });

  it('draws the bar alone where the caller draws the numbers, still reading them out', () => {
    const { container, rerender } = render(
      <UsageMeter
        limitKey="callMinutesPerMonth"
        used={240}
        limit={1000}
        words="240 of 1,000 used"
        showLabel={false}
        showWords={false}
        layout="stacked"
      />,
    );
    expect(screen.queryByText('240 of 1,000 used')).toBeNull();
    expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toBe('240 of 1,000 used');
    expect(container.firstElementChild!.children).toHaveLength(1);
    // The badge still follows the bar for an owner on Pro.
    rerender(
      <UsageMeter limitKey="callMinutesPerMonth" used={240} limit={10000} showWords={false} pro />,
    );
    expect(screen.getByRole('img', { name: 'You Have Pro' })).toBeTruthy();
    expect(screen.queryByText(/240/)).toBeNull();
  });

  it('shows the solid badge for an owner on Pro', () => {
    render(<UsageMeter limitKey="automationRunsPerMonth" used={142} limit={1500} pro />);
    expect(screen.getByRole('img', { name: 'You Have Pro' })).toBeTruthy();
  });
});
