// @vitest-environment jsdom

// One footer tab (docs/specs/007-editor/editor-app.md "How a tab looks"): the name is the strip's `tab`, the open
// tab's name takes its accent, a cut-short name shows in full in a Tooltip, and the caret and dimming show a drag.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

describe('TabFrame', () => {
  it('is a tab of the strip: selected and focusable only when open', () => {
    const { rerender } = render(<TabFrame {...props()} />);
    let tab = screen.getByRole('tab', { name: 'Roadmap' });
    expect(tab.getAttribute('aria-selected')).toBe('false');
    expect(tab.tabIndex).toBe(-1);
    rerender(<TabFrame {...props({ active: true })} />);
    tab = screen.getByRole('tab', { name: 'Roadmap' });
    expect(tab.getAttribute('aria-selected')).toBe('true');
    expect(tab.tabIndex).toBe(0);
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
    fireEvent.click(screen.getByRole('tab'));
    expect(onSelect).toHaveBeenCalledOnce();
    fireEvent.doubleClick(screen.getByRole('tab'));
    expect(onRequestRename).not.toHaveBeenCalled();
    rerender(<TabFrame {...props({ active: true, onSelect, onRequestRename })} />);
    fireEvent.doubleClick(screen.getByRole('tab'));
    expect(onRequestRename).toHaveBeenCalledOnce();
    rerender(<TabFrame {...props({ active: true, readOnly: true, onSelect, onRequestRename })} />);
    fireEvent.doubleClick(screen.getByRole('tab'));
    expect(onRequestRename).toHaveBeenCalledOnce();
  });

  it('swaps the name for the rename field, and is not draggable while renaming or for a Viewer', () => {
    const { container, rerender } = render(
      <TabFrame {...props({ active: true, renameField: <input aria-label="Tab name" /> })} />,
    );
    expect(screen.queryByRole('tab')).toBeNull();
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
    const tab = screen.getByRole('tab');
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
    fireEvent.contextMenu(screen.getByRole('tab'));
    expect(onDragStart).toHaveBeenCalledOnce();
    expect(onContextMenu).toHaveBeenCalledOnce();
  });

  it('shows the full name in a Tooltip only when the name is cut short', () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(300);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(224);
    const long = 'Quarterly planning for the platform team';
    const { container } = render(<TabFrame {...props({ name: long })} />);
    // The Tooltip wraps the button in its trigger.
    expect(screen.getByRole('tab').parentElement?.className).toBe('contents');
    vi.restoreAllMocks();
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(80);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(80);
    cleanup();
    render(<TabFrame {...props()} />);
    expect(screen.getByRole('tab').parentElement?.hasAttribute('data-tab')).toBe(true);
    expect(container).toBeTruthy();
  });
});
