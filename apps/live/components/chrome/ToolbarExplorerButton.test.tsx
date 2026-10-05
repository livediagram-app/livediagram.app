// @vitest-environment jsdom
// The Toolbar layout's menu button (docs/specs/007-editor/toolbar-layout.md): it toggles the Explorer and
// hands itself over as the popover's anchor.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorModeProvider } from './editor-mode/editor-mode-context';
import { ToolbarExplorerButton } from './ToolbarExplorerButton';

afterEach(cleanup);

describe('ToolbarExplorerButton', () => {
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

  it("sits inside the dock's outside-click exemption", () => {
    // Otherwise pressing it while the Explorer is open would close the panel
    // on pointer-down and reopen it on click.
    render(<ToolbarExplorerButton open onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Explorer' }).closest('[data-dock-button]')).not.toBe(
      null,
    );
  });

  // The canvas's capture-phase gestures skip floating chrome: without the marker a press on the
  // card (its mode switch menu included) with a Draw pen in hand started a stroke instead.
  it('marks its card as floating chrome, so a Draw tool in hand never takes the press', () => {
    render(<ToolbarExplorerButton open={false} onToggle={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: 'Explorer' }).closest('[data-floating-panel]'),
    ).not.toBeNull();
  });

  // docs/specs/007-editor/editor-modes.md "The mode switch": beside the menu button, wherever it sits.
  it.each([false, true])('carries the editor mode switch beside it (inline %s)', (inline) => {
    render(
      <EditorModeProvider
        value={{ mode: 'diagram', setMode: vi.fn(), canSwitch: true, canEdit: true }}
      >
        <ToolbarExplorerButton open={false} onToggle={vi.fn()} inline={inline} />
      </EditorModeProvider>,
    );
    const card = screen.getByRole('button', { name: 'Explorer' }).closest('[data-dock-button]')!;
    expect(card.contains(screen.getByRole('button', { name: 'Editor mode: Diagram' }))).toBe(true);
  });
});
