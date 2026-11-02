// @vitest-environment jsdom

// One footer tab (docs/specs/007-editor/editor-app.md "How a tab looks"): the name is a button of the strip, the open
// tab's name takes its accent, a cut-short name shows in full in a Tooltip, and the caret and dimming show a drag.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TAB_SLIDE_MS } from './useTabSlider';
import { TabFrame, type TabFrameProps } from './TabFrame';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const props = (over: Partial<TabFrameProps> = {}): TabFrameProps => ({
  id: 't1',
  name: 'Roadmap',
  active: false,
  readOnly: false,
  onSelect: vi.fn(),
  ...over,
});
const root = (c: HTMLElement) => c.querySelector('[data-tab]') as HTMLElement;
// The name's button, whatever the name.
const nameKey = () => document.querySelector('[data-tab-key]') as HTMLElement;

describe('TabFrame', () => {
  it('is a button of the strip, never a tab: current and focusable only when open', () => {
    const { rerender } = render(<TabFrame {...props()} />);
    let tab = screen.getByRole('button', { name: 'Roadmap' });
    expect(tab.hasAttribute('aria-current')).toBe(false);
    expect(tab.tabIndex).toBe(-1);
    rerender(<TabFrame {...props({ active: true })} />);
    tab = screen.getByRole('button', { name: 'Roadmap' });
    expect(tab.getAttribute('aria-current')).toBe('page');
    expect(tab.tabIndex).toBe(0);
    expect(screen.queryByRole('tab')).toBeNull();
    expect(tab.hasAttribute('aria-selected')).toBe(false);
  });

  it('colours only the open tab’s name with its accent', () => {
    const { container, rerender } = render(<TabFrame {...props({ accent: '#0369a1' })} />);
    expect(root(container).style.color).toBe('');
    rerender(<TabFrame {...props({ active: true, accent: '#0369a1' })} />);
    expect(root(container).style.color).toBe('rgb(3, 105, 161)');
    expect(root(container).hasAttribute('data-active')).toBe(true);
  });

  it('selects on click and renames the open tab on double-click, never a Viewer’s', () => {
    const onSelect = vi.fn();
    const onRequestRename = vi.fn();
    const { rerender } = render(<TabFrame {...props({ onSelect, onRequestRename })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Roadmap' }));
    expect(onSelect).toHaveBeenCalledOnce();
    fireEvent.doubleClick(screen.getByRole('button', { name: 'Roadmap' }));
    expect(onRequestRename).not.toHaveBeenCalled();
    rerender(<TabFrame {...props({ active: true, onSelect, onRequestRename })} />);
    fireEvent.doubleClick(screen.getByRole('button', { name: 'Roadmap' }));
    expect(onRequestRename).toHaveBeenCalledOnce();
    rerender(<TabFrame {...props({ active: true, readOnly: true, onSelect, onRequestRename })} />);
    fireEvent.doubleClick(screen.getByRole('button', { name: 'Roadmap' }));
    expect(onRequestRename).toHaveBeenCalledOnce();
  });

  it('swaps the name for the rename field, and is not draggable while renaming or for a Viewer', () => {
    const { container, rerender } = render(
      <TabFrame {...props({ active: true, renameField: <input aria-label="Tab name" /> })} />,
    );
    expect(screen.queryByRole('button', { name: 'Roadmap' })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Tab name' })).toBeTruthy();
    expect(root(container).getAttribute('draggable')).toBe('false');
    rerender(<TabFrame {...props({ readOnly: true })} />);
    expect(root(container).getAttribute('draggable')).toBe('false');
    rerender(<TabFrame {...props()} />);
    expect(root(container).getAttribute('draggable')).toBe('true');
  });

  it('puts the lock before the name and the slots after it', () => {
    render(
      <TabFrame
        {...props({
          lockIcon: <svg data-testid="lock" />,
          afterName: <span data-testid="after" />,
          presence: <span data-testid="presence" />,
          menu: <button type="button">Tab menu</button>,
        })}
      />,
    );
    const tab = screen.getByRole('button', { name: 'Roadmap' });
    expect(tab.firstElementChild?.querySelector('[data-testid="lock"]')).toBeTruthy();
    expect(tab.querySelector('[data-testid="after"]')).toBeTruthy();
    expect(screen.getByTestId('presence')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tab menu' })).toBeTruthy();
  });

  it('draws the drag caret on the side the tab will land, and dims the dragged tab', () => {
    const { container, rerender } = render(<TabFrame {...props({ caret: 'before' })} />);
    expect(container.querySelector('[aria-hidden].-left-\\[2px\\]')).toBeTruthy();
    rerender(<TabFrame {...props({ caret: 'after', dragging: true })} />);
    expect(container.querySelector('[aria-hidden].-right-\\[2px\\]')).toBeTruthy();
    expect(root(container).className).toMatch(/\bopacity-50\b/);
  });

  it('passes the drag handlers and the context menu to the tab', () => {
    const onDragStart = vi.fn();
    const onContextMenu = vi.fn();
    const { container } = render(
      <TabFrame {...props({ dragHandlers: { onDragStart }, onContextMenu })} />,
    );
    fireEvent.dragStart(root(container));
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Roadmap' }));
    expect(onDragStart).toHaveBeenCalledOnce();
    expect(onContextMenu).toHaveBeenCalledOnce();
  });

  it('shows the full name in a Tooltip only when the name is cut short', () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(300);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(224);
    const long = 'Quarterly planning for the platform team';
    const { container } = render(<TabFrame {...props({ name: long })} />);
    // The Tooltip wraps the button in its trigger.
    expect(nameKey().parentElement?.className).toBe('contents');
    vi.restoreAllMocks();
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(80);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(80);
    cleanup();
    render(<TabFrame {...props()} />);
    expect(nameKey().parentElement?.hasAttribute('data-tab')).toBe(true);
    expect(container).toBeTruthy();
  });

  describe('the trailing slots', () => {
    const slot = (c: HTMLElement, i: number) =>
      c.querySelectorAll<HTMLElement>('[data-collapse-width]')[i]!;

    it('keeps the presence, menu and padding slots in every tab, open only when filled', () => {
      const { container } = render(
        <TabFrame {...props({ presence: <i data-testid="who" />, hasPresence: false })} />,
      );
      expect(slot(container, 0).dataset.collapseWidth).toBe('shut');
      expect(slot(container, 1).dataset.collapseWidth).toBe('shut');
      // No menu button: the padding spacer keeps the tab's even padding.
      expect(slot(container, 2).dataset.collapseWidth).toBe('open');
    });

    it('opens the presence slot when it shows someone, or whenever presence is given and unsaid', () => {
      const { container, rerender } = render(
        <TabFrame {...props({ presence: <i />, hasPresence: true })} />,
      );
      expect(slot(container, 0).dataset.collapseWidth).toBe('open');
      rerender(<TabFrame {...props({ presence: <i /> })} />);
      expect(slot(container, 0).dataset.collapseWidth).toBe('open');
      rerender(<TabFrame {...props()} />);
      expect(slot(container, 0).dataset.collapseWidth).toBe('shut');
    });

    it('eases the menu button in, and holds it while it eases out, then drops it', () => {
      vi.useFakeTimers();
      const menu = <button type="button">More</button>;
      const { container, rerender } = render(<TabFrame {...props({ active: true })} />);
      expect(slot(container, 1).dataset.collapseWidth).toBe('shut');
      rerender(<TabFrame {...props({ active: true, menu })} />);
      expect(slot(container, 1).dataset.collapseWidth).toBe('open');
      expect(slot(container, 2).dataset.collapseWidth).toBe('shut');
      rerender(<TabFrame {...props({ active: false })} />);
      expect(slot(container, 1).dataset.collapseWidth).toBe('shut');
      expect(slot(container, 1).querySelector('button')).not.toBeNull();
      expect(slot(container, 2).dataset.collapseWidth).toBe('open');
      act(() => {
        vi.advanceTimersByTime(TAB_SLIDE_MS + 50);
      });
      expect(slot(container, 1).querySelector('button')).toBeNull();
      vi.useRealTimers();
    });

    it('sheds the padding spacer while renaming', () => {
      const { container } = render(<TabFrame {...props({ renameField: <input /> })} />);
      expect(slot(container, 2).dataset.collapseWidth).toBe('shut');
    });
  });
});
