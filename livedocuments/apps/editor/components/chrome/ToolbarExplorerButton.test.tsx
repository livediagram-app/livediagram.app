// @vitest-environment jsdom
// The Toolbar layout's menu button (docs/specs/007-editor/toolbar-layout.md): it toggles the Explorer and
// hands itself over as the popover's anchor.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setActiveTabName } from '@liveworkspace/workbench/hooks/editor/active-tab-name-store';
import { ToolbarExplorerButton } from './ToolbarExplorerButton';

const viewport = vi.hoisted(() => ({ phone: false }));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => viewport.phone,
}));

afterEach(() => {
  cleanup();
  viewport.phone = false;
  act(() => setActiveTabName(''));
});

// The open tab's name beside the menu button (docs/specs/007-editor/toolbar-layout.md "The tab's name"), as in every
// editor (Work Tracker #105): on a desktop, never on a phone or inline in the strip's row.
describe('the tab name beside the menu button', () => {
  const name = () => document.querySelector('[data-tab-name-in-box]');

  it('shows the open tab’s name on a desktop', () => {
    act(() => setActiveTabName('Chapter One'));
    render(<ToolbarExplorerButton open={false} onToggle={vi.fn()} />);
    expect(name()?.textContent).toBe('Chapter One');
  });

  it('leaves it out on a phone, and inline in the strip', () => {
    act(() => setActiveTabName('Chapter One'));
    viewport.phone = true;
    const { unmount } = render(<ToolbarExplorerButton open={false} onToggle={vi.fn()} />);
    expect(name()).toBeNull();
    unmount();
    viewport.phone = false;
    render(<ToolbarExplorerButton open={false} inline onToggle={vi.fn()} />);
    expect(name()).toBeNull();
  });
});

describe('ToolbarExplorerButton', () => {
  // It got in the way of the Explorer's app switcher (Work Tracker #101); the aria-label still names it.
  it('shows no hover card on the menu button, and keeps its accessible name', () => {
    render(<ToolbarExplorerButton open={false} onToggle={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Explorer' });
    fireEvent.pointerEnter(button, { pointerType: 'mouse' });
    fireEvent.focus(button);
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(button.getAttribute('aria-label')).toBe('Explorer');
  });

  it('passes its own element to the toggle, to anchor the popover under it', () => {
    const onToggle = vi.fn();
    render(<ToolbarExplorerButton open={false} onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: 'Explorer' });
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledWith(button);
  });

  it('reports whether the Explorer is open', () => {
    const { rerender } = render(<ToolbarExplorerButton open={false} onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Explorer' }).getAttribute('aria-expanded')).toBe(
      'false',
    );
    rerender(<ToolbarExplorerButton open onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Explorer' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
  });

  it('keeps its focus as the Explorer opens, so a keyboard opener is not dropped to the page', () => {
    // It used to lose its hover card on open, which re-parented the button and remounted it.
    const { rerender } = render(<ToolbarExplorerButton open={false} onToggle={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Explorer' });
    button.focus();
    rerender(<ToolbarExplorerButton open onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Explorer' })).toBe(button);
    expect(document.activeElement).toBe(button);
  });

  it("sits inside the dock's outside-click exemption", () => {
    // Otherwise pressing it while the Explorer is open would close the panel
    // on pointer-down and reopen it on click.
    render(<ToolbarExplorerButton open onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Explorer' }).closest('[data-dock-button]')).not.toBe(
      null,
    );
  });

  // The canvas's capture-phase gestures skip floating chrome: without the marker a press on the
  // card with a Draw pen in hand started a stroke instead.
  it('marks its card as floating chrome, so a Draw tool in hand never takes the press', () => {
    render(<ToolbarExplorerButton open={false} onToggle={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: 'Explorer' }).closest('[data-floating-panel]'),
    ).not.toBeNull();
  });
});

// docs/specs/007-editor/pages-mode.md "Joined to the menu box": heading the docked Contents sidebar, the box drops its
// own frame and reaches across the sidebar; its button and name stay as they are.
describe('the menu box joined to the Contents sidebar', () => {
  const card = () => document.querySelector<HTMLElement>('[data-toolbar-menu]')!;

  it('is its usual card unjoined', () => {
    render(<ToolbarExplorerButton open={false} onToggle={vi.fn()} />);
    expect(card().hasAttribute('data-menu-joined')).toBe(false);
    expect(card().style.width).toBe('');
    expect(card().className.split(' ')).not.toContain('border-transparent!');
  });

  it('joined, drops its frame and spans the sidebar less the strip’s gap, at the toolbar’s scale', () => {
    act(() => setActiveTabName('Chapter One'));
    render(<ToolbarExplorerButton open={false} onToggle={vi.fn()} joinedWidth={236} />);
    expect(card().hasAttribute('data-menu-joined')).toBe(true);
    expect(card().className.split(' ')).toContain('border-transparent!');
    expect(card().className.split(' ')).toContain('bg-transparent!');
    expect(card().style.width).toBe('216px');
    // The button and the name are as ever.
    expect(screen.getByRole('button', { name: 'Explorer' }).className).toContain('h-9 w-9');
    expect(document.querySelector('[data-tab-name-in-box]')?.textContent).toBe('Chapter One');
  });

  it('never joins inline in the strip’s row', () => {
    render(<ToolbarExplorerButton open={false} inline onToggle={vi.fn()} joinedWidth={236} />);
    expect(card().hasAttribute('data-menu-joined')).toBe(false);
  });
});
