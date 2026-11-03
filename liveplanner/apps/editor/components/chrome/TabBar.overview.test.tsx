// @vitest-environment jsdom

// The Plan Overview's entry in the tab bar (docs/specs/026-plan/plan-overview.md "The tab bar"): first in the strip's
// toolbar with a divider after it, the open entry while the Overview is open, and pressing the tab that was open
// opens it again.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TabBar } from './TabBar';
import { tabBarProps as props } from './TabBar.test-props';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const names = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-tab-key]')).map((el) => el.textContent);

describe('TabBar Overview', () => {
  it('has no Overview entry when the bar is given none (an embed, a tab-scoped session)', () => {
    const { container } = render(<TabBar {...props({})} />);
    expect(names(container)).toEqual(['First', 'Second']);
    expect(container.querySelector('[data-overview-divider]')).toBeNull();
  });

  it('stands first in the toolbar, then a divider, then the tabs', () => {
    const { container } = render(
      <TabBar {...props({ overview: { open: false, onOpen: vi.fn() } })} />,
    );
    const toolbar = screen.getByRole('toolbar', { name: 'Tabs' });
    expect(toolbar.contains(screen.getByRole('button', { name: 'Overview' }))).toBe(true);
    expect(names(container)).toEqual(['Overview', 'First', 'Second']);
    const divider = container.querySelector('[data-overview-divider]') as HTMLElement;
    expect(divider.getAttribute('aria-hidden')).toBe('true');
    // Closed: the open tab is still the current one.
    expect(screen.getByRole('button', { name: 'First' }).getAttribute('aria-current')).toBe('page');
    expect(
      screen.getByRole('button', { name: 'Overview' }).getAttribute('aria-current'),
    ).toBeNull();
  });

  it('opens the Overview when pressed', () => {
    const onOpen = vi.fn();
    render(<TabBar {...props({ overview: { open: false, onOpen } })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('is the current entry while open, no tab is, and it has no menu', () => {
    const { container } = render(
      <TabBar {...props({ overview: { open: true, onOpen: vi.fn() } })} />,
    );
    expect(screen.getByRole('button', { name: 'Overview' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(screen.getByRole('button', { name: 'First' }).getAttribute('aria-current')).toBeNull();
    expect(container.querySelectorAll('[data-tab][data-active]')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /menu/i })).toBeNull();
  });

  it('opens the tab that was open again when it is pressed over the Overview', () => {
    const onSelect = vi.fn();
    render(<TabBar {...props({ onSelect, overview: { open: true, onOpen: vi.fn() } })} />);
    fireEvent.click(screen.getByRole('button', { name: 'First' }));
    expect(onSelect).toHaveBeenCalledWith('t1');
  });
});
