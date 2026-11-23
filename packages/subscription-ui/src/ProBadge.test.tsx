// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProBadge } from './ProBadge';
import { setProForTests } from './testing';

// subscription.md "What people see", "The Pro badge".

describe('ProBadge', () => {
  it('solid says you have Pro, in ink that inverts in the dark appearance', () => {
    render(<ProBadge />);
    const badge = screen.getByRole('img', { name: 'You Have Pro' });
    expect(badge.getAttribute('data-pro-badge')).toBe('solid');
    expect(badge.textContent).toBe('PRO');
    expect(badge.classList).toContain('bg-slate-900');
    expect(badge.classList).toContain('dark:bg-white');
    expect(badge.classList).toContain('dark:text-slate-900');
    // The small liveworkspace logo, drawn in the pill's own ink.
    expect(badge.querySelector('svg')).not.toBeNull();
    expect(badge.querySelector('svg linearGradient')).toBeNull();
  });

  it('outline says the thing is part of Pro', () => {
    render(<ProBadge form="outline" size="sm" />);
    const badge = screen.getByRole('img', { name: 'Part of Pro' });
    expect(badge.getAttribute('data-pro-badge')).toBe('outline');
    expect(badge.textContent).toBe('PRO');
    expect(badge.classList).toContain('border-slate-300');
    expect(badge.classList).toContain('dark:border-slate-500');
    expect(badge.classList).not.toContain('bg-slate-900');
  });

  it('mark is the logo alone, still named', () => {
    render(<ProBadge form="mark" />);
    const badge = screen.getByRole('img', { name: 'Part of Pro' });
    expect(badge.getAttribute('data-pro-badge')).toBe('mark');
    expect(badge.textContent).toBe('');
    expect(badge.querySelector('svg')).not.toBeNull();
  });

  it('on an ink ground the pair is the dark one whatever the appearance', () => {
    render(<ProBadge ground="ink" label="Pro" />);
    const badge = screen.getByRole('img', { name: 'Pro' });
    expect(badge.classList).toContain('bg-white');
    expect(badge.classList).toContain('text-slate-900');
    expect([...badge.classList].some((c) => c.startsWith('dark:'))).toBe(false);
  });

  it('takes its own name, for a team', () => {
    render(<ProBadge label="Northwind Studio Has Pro for Teams" />);
    expect(screen.getByRole('img', { name: 'Northwind Studio Has Pro for Teams' })).toBeTruthy();
  });

  it('is nothing with Pro off', () => {
    setProForTests(false);
    const { container } = render(
      <>
        <ProBadge />
        <ProBadge form="outline" />
        <ProBadge form="mark" />
      </>,
    );
    expect(container.innerHTML).toBe('');
  });
});
