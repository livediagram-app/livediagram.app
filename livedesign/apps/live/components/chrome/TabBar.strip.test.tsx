// @vitest-environment jsdom

// The tab strip (docs/specs/007-editor/live-app.md "Tab bar", "How a tab looks"): no Tabs label before the tabs,
// and a tap on the tab already open brings all of it into view rather than switching to it again.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TabBar } from './TabBar';
import { tabBarProps as props } from './TabBar.test-props';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('TabBar strip', () => {
  it('has no Tabs label before the tabs', () => {
    const { container } = render(<TabBar {...props({})} />);
    const bar = container.querySelector('[data-editor-tabbar]') as HTMLElement;
    expect(bar.textContent).not.toMatch(/^Tabs/);
    expect(screen.queryByText('Tabs')).toBeNull();
  });

  it('brings the whole open tab into view on a tap, without selecting it again', () => {
    const onSelect = vi.fn();
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      value: scrollTo,
      configurable: true,
    });
    const { container } = render(<TabBar {...props({ onSelect })} />);
    const strip = container.querySelector('[role="tablist"]')!.parentElement as HTMLElement;
    // The strip shows 0 to 100; the open tab (its menu button included) runs 60 to 140, past the right edge.
    vi.spyOn(strip, 'getBoundingClientRect').mockReturnValue({ left: 0, right: 100 } as DOMRect);
    const openTab = container.querySelector('[data-tab][data-active]') as HTMLElement;
    vi.spyOn(openTab, 'getBoundingClientRect').mockReturnValue({ left: 60, right: 140 } as DOMRect);
    fireEvent.click(screen.getByRole('tab', { name: 'First' }));
    expect(onSelect).not.toHaveBeenCalled();
    // Measured on the whole tab, not its name, and clear of the 20px edge fade.
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 68 }));
  });

  it('switches to another tab as before', () => {
    const onSelect = vi.fn();
    render(<TabBar {...props({ onSelect })} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Second' }));
    expect(onSelect).toHaveBeenCalledWith('t2');
  });
});
