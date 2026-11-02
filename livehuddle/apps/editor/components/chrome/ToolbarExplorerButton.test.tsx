// @vitest-environment jsdom
// The Toolbar layout's menu button (docs/specs/007-editor/toolbar-layout.md): it toggles the Explorer and
// hands itself over as the popover's anchor.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { EditorModeState } from '@/hooks/editor/useEditorMode';
import { EditorModeProvider } from './editor-mode/editor-mode-context';
import { ToolbarExplorerButton } from './ToolbarExplorerButton';

afterEach(() => {
  cleanup();
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

  // docs/specs/007-editor/editor-modes.md "The mode switch": the switch rides right of the menu button, in its card,
  // named on a computer and its icon alone on a phone (inline, the strip's row).
  const withEditor = (ui: ReactNode, over: Partial<EditorModeState> = {}) =>
    render(
      <EditorModeProvider
        value={{ mode: 'draw', setMode: vi.fn(), canSwitch: true, canEdit: true, ...over }}
      >
        {ui}
      </EditorModeProvider>,
    );

  it('carries the mode switch right of the menu button, in the same card', () => {
    withEditor(<ToolbarExplorerButton open={false} onToggle={vi.fn()} />);
    const menu = screen.getByRole('button', { name: 'Explorer' });
    const mode = screen.getByRole('button', { name: 'Editor mode: Draw' });
    const card = menu.closest('[data-toolbar-menu]');
    expect(card).not.toBeNull();
    expect(mode.closest('[data-toolbar-menu]')).toBe(card);
    expect(menu.compareDocumentPosition(mode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(mode.textContent).toBe('Draw');
  });

  it('drops the label on a phone (inline in the strip)', () => {
    withEditor(<ToolbarExplorerButton open={false} onToggle={vi.fn()} inline />);
    expect(screen.getByRole('button', { name: 'Editor mode: Draw' }).textContent).toBe('');
  });

  it('carries no switch for a session that cannot edit', () => {
    withEditor(<ToolbarExplorerButton open={false} onToggle={vi.fn()} />, { canEdit: false });
    expect(screen.getByRole('button', { name: 'Explorer' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /mode:/ })).toBeNull();
  });
});
