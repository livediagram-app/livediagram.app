// @vitest-environment jsdom

// The editor header's badge for an item saved only in this browser reads "This Browser", matching
// the Explorer's pill (docs/specs/006-<kind>/offline-mode.md#this-browser-badge--explorer).

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { THIS_BROWSER_DESCRIPTION, THIS_BROWSER_LABEL } from '../primitives/ThisBrowserPill';
import { SharedBadge } from './SharedBadge';

afterEach(cleanup);

describe('SharedBadge', () => {
  it('reads This Browser for an item in this browser, never Offline', () => {
    render(<SharedBadge shareable={false} offline />);
    const badge = screen.getByText(THIS_BROWSER_LABEL).closest('[tabindex]') as HTMLElement;
    expect(badge.textContent).toContain('This Browser');
    expect(badge.textContent).not.toContain('Offline');
  });

  it('carries an icon beside the words, not colour alone', () => {
    render(<SharedBadge shareable={false} offline />);
    const badge = screen.getByText(THIS_BROWSER_LABEL).closest('[tabindex]') as HTMLElement;
    expect(badge.querySelector('svg')).not.toBeNull();
  });

  it('is named This Browser and described with the pill sentence', () => {
    render(<SharedBadge shareable={false} offline />);
    const badge = screen.getByText(THIS_BROWSER_LABEL).closest('[tabindex]') as HTMLElement;
    expect(badge.getAttribute('aria-label')).toBe(THIS_BROWSER_LABEL);
    const id = badge.getAttribute('aria-describedby');
    expect(document.getElementById(id!)?.textContent).toBe(THIS_BROWSER_DESCRIPTION);
  });

  it('explains it in the legend on focus', () => {
    render(<SharedBadge shareable={false} offline />);
    const badge = screen.getByText(THIS_BROWSER_LABEL).closest('[tabindex]') as HTMLElement;
    fireEvent.focus(badge);
    expect(screen.getAllByText(THIS_BROWSER_DESCRIPTION).length).toBeGreaterThan(1);
  });

  it('keeps the other states named and described the same way', () => {
    render(<SharedBadge shareable={false} />);
    const badge = screen.getByText('Private').closest('[tabindex]') as HTMLElement;
    expect(badge.getAttribute('aria-label')).toBe('Private');
    const id = badge.getAttribute('aria-describedby');
    expect(document.getElementById(id!)?.textContent).toBe('Only visible to you.');
  });
});

// docs/specs/025-community/community.md: listed in the Community, the item is public.
describe('SharedBadge in the Community', () => {
  it('reads Public while listed, over Shared, and This Browser still wins', () => {
    render(<SharedBadge shareable community />);
    expect(screen.getByText('Public')).toBeTruthy();
    expect(screen.queryByText('Shared')).toBeNull();
    cleanup();
    render(<SharedBadge shareable={false} offline community />);
    expect(screen.getByText(THIS_BROWSER_LABEL)).toBeTruthy();
    expect(screen.queryByText('Public')).toBeNull();
  });
});

// docs/specs/006-<kind>/offline-mode.md "The visibility legend": the reach scale, the hover preview and
// Change Who Can See This.
describe('SharedBadge legend', () => {
  it('marks the current audience on the scale', () => {
    render(<SharedBadge shareable />);
    fireEvent.focus(screen.getByText('Shared').closest('[tabindex]')!);
    const legend = document.querySelector('[data-visibility-legend]')!;
    expect(legend.querySelector('[data-current]')?.textContent).toBe('Link');
    expect(legend.querySelector('[data-legend-hero]')?.getAttribute('data-legend-hero')).toBe(
      'shared',
    );
  });

  it('shows a hovered audience in the hero, then puts the current one back', () => {
    render(<SharedBadge shareable={false} />);
    fireEvent.focus(screen.getByText('Private').closest('[tabindex]')!);
    const legend = document.querySelector('[data-visibility-legend]')!;
    const hero = () => legend.querySelector('[data-legend-hero]')!;
    fireEvent.mouseEnter(screen.getByText('Everyone').closest('li')!);
    expect(hero().getAttribute('data-legend-hero')).toBe('community');
    expect(hero().textContent).toContain('If It Were');
    fireEvent.mouseLeave(screen.getByText('Everyone').closest('ol')!);
    expect(hero().getAttribute('data-legend-hero')).toBe('private');
    expect(hero().textContent).toContain('Who Can See This');
  });

  it('keeps the hero one size: every audience’s words in one cell, only the shown one exposed', () => {
    render(<SharedBadge shareable={false} />);
    fireEvent.focus(screen.getByText('Private').closest('[tabindex]')!);
    const hero = document.querySelector('[data-legend-hero]')!;
    const blocks = [...hero.querySelectorAll('[class*="grid-area"]')];
    expect(blocks).toHaveLength(5);
    const shown = blocks.filter((b) => !b.hasAttribute('aria-hidden'));
    expect(shown).toHaveLength(1);
    expect(shown[0]!.className).not.toContain('invisible');
    fireEvent.mouseEnter(screen.getByText('Everyone').closest('li')!);
    expect(blocks.filter((b) => !b.hasAttribute('aria-hidden'))[0]!.textContent).toContain(
      'If It Were',
    );
  });

  it('opens Share from the pill and from the legend when the reader may share', () => {
    const onManage = vi.fn();
    render(<SharedBadge shareable={false} onManage={onManage} />);
    const pill = screen.getByRole('button', { name: 'Private' });
    expect(pill.getAttribute('aria-describedby')).toBeTruthy();
    fireEvent.click(pill);
    expect(onManage).toHaveBeenCalledTimes(1);
    fireEvent.focus(pill);
    fireEvent.click(screen.getByText('Change Who Can See This'));
    expect(onManage).toHaveBeenCalledTimes(2);
    expect(document.querySelector('[data-visibility-legend]')).toBeNull();
  });

  it('offers no change to a reader who may not share', () => {
    render(<SharedBadge shareable={false} />);
    expect(screen.queryByRole('button', { name: 'Private' })).toBeNull();
    fireEvent.focus(screen.getByText('Private').closest('[tabindex]')!);
    expect(screen.queryByText('Change Who Can See This')).toBeNull();
  });

  it('lays its manage button out as a box, so the chip sits level with the role pill', () => {
    render(<SharedBadge shareable={false} onManage={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Private' });
    // An inline button's line box stood it 24 px tall around the 19 px chip, which then sat low.
    expect(button.className.split(' ')).toContain('flex');
  });
});

// The pill's legend opens on hover and focus and closes a moment after the pointer leaves; where a panel's scroll
// would clip it (the Explorer's card), it opens over everything, right-aligned under the pill.
describe('SharedBadge legend opening', () => {
  const legend = () => document.querySelector('[data-visibility-legend]');

  it('opens on hover, stays while the pointer crosses over, and closes after a grace', () => {
    vi.useFakeTimers();
    try {
      render(<SharedBadge shareable={false} />);
      const anchor = screen.getByText('Private').closest('[tabindex]')!.parentElement!;
      fireEvent.mouseEnter(anchor);
      expect(legend()).not.toBeNull();
      fireEvent.mouseLeave(anchor);
      fireEvent.mouseEnter(anchor);
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(legend()).not.toBeNull();
      fireEvent.mouseLeave(anchor);
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(legend()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('closes when focus leaves the pill', () => {
    render(<SharedBadge shareable={false} />);
    const pill = screen.getByText('Private').closest('[tabindex]')!;
    fireEvent.focus(pill);
    expect(legend()).not.toBeNull();
    fireEvent.blur(pill);
    expect(legend()).toBeNull();
  });

  it('previews This Browser from its row and puts the current state back', () => {
    render(<SharedBadge shareable />);
    fireEvent.focus(screen.getByText('Shared').closest('[tabindex]')!);
    const hero = () => legend()!.querySelector('[data-legend-hero]')!;
    const row = screen.getByText(/^Or This Browser/).closest('[class*="mx-3"]')!;
    fireEvent.mouseEnter(row);
    expect(hero().getAttribute('data-legend-hero')).toBe('offline');
    fireEvent.mouseLeave(row);
    expect(hero().getAttribute('data-legend-hero')).toBe('shared');
  });

  it('marks This Browser as current for an item in this browser', () => {
    render(<SharedBadge shareable={false} offline />);
    fireEvent.focus(screen.getByText(THIS_BROWSER_LABEL).closest('[tabindex]')!);
    expect(screen.getByText(/saved only here/)).toBeTruthy();
  });

  it('portals the legend over everything, under the pill’s right edge', () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<SharedBadge shareable={false} portal />);
      const anchor = container.firstElementChild as HTMLElement;
      vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({
        bottom: 40,
        right: window.innerWidth - 24,
      } as DOMRect);
      fireEvent.mouseEnter(anchor);
      const floating = legend()!.parentElement as HTMLElement;
      expect(container.contains(floating)).toBe(false);
      expect(floating.style.top).toBe('40px');
      expect(floating.style.right).toBe('24px');
      fireEvent.mouseLeave(anchor);
      fireEvent.mouseEnter(floating);
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(legend()).not.toBeNull();
      fireEvent.mouseLeave(floating);
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(legend()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
