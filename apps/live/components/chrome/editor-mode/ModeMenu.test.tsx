// @vitest-environment jsdom

// The mode menu (docs/specs/007-editor/editor-modes.md "The mode switch"): a list of the modes and a
// preview of one, following the pointer, else focus, else the current mode. The preview has no button:
// choosing is the row's alone. It opens from a start panel's named chip.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { editorModeDescription, type EditorMode } from '@livediagram/document';
import { ModeMenuChip } from './ModeMenuChip';
import { MODE_TOOLS } from './mode-menu-copy';

const confirm = vi.hoisted(() => vi.fn(async () => true));
vi.mock('@/hooks/ui/useConfirm', () => ({ useConfirm: () => confirm }));

afterEach(() => {
  cleanup();
  confirm.mockClear();
});

function open(
  mode: EditorMode,
  over: Partial<Parameters<typeof ModeMenuChip>[0]> = {},
): { onChange: ReturnType<typeof vi.fn>; newTabIn: ReturnType<typeof vi.fn> } {
  const onChange = vi.fn();
  const newTabIn = vi.fn();
  render(<ModeMenuChip mode={mode} onChange={onChange} newTabIn={newTabIn} {...over} />);
  fireEvent.click(screen.getByRole('button', { name: /mode:/ }));
  return { onChange, newTabIn };
}

const preview = () => document.querySelector<HTMLElement>('[data-mode-preview]')!;
const row = (name: string) => screen.getByRole('menuitemradio', { name: new RegExp(`^${name}`) });

describe('ModeMenu preview', () => {
  it('shows the current mode until a row is pointed at, then follows the pointer', () => {
    open('diagram');
    expect(preview().dataset.modePreview).toBe('diagram');
    expect(preview().textContent).toContain(editorModeDescription('diagram'));
    for (const tool of MODE_TOOLS.diagram) expect(preview().textContent).toContain(tool);

    fireEvent.pointerEnter(row('Facilitate'));
    expect(preview().dataset.modePreview).toBe('facilitate');
    expect(preview().textContent).toContain(editorModeDescription('facilitate'));
  });

  it('follows keyboard focus too', () => {
    open('diagram');
    fireEvent.focus(row('Illustrate'));
    expect(preview().dataset.modePreview).toBe('illustrate');
  });

  it('is hidden from assistive technology and holds no button', () => {
    open('diagram');
    expect(preview().getAttribute('aria-hidden')).toBe('true');
    fireEvent.pointerEnter(row('Facilitate'));
    expect(preview().querySelector('button')).toBeNull();
    expect(preview().textContent).not.toContain('Switch to');
    // The menu's items are its rows alone.
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(5);
  });

  it('is left out under 640px, each row then showing its description', () => {
    open('diagram');
    expect(preview().className).toMatch(/(^| )hidden( |$)/);
    expect(preview().className).toMatch(/sm:flex/);
    const description = document.getElementById(row('Draw').getAttribute('aria-describedby')!)!;
    expect(description.className).toMatch(/sm:sr-only/);
    expect(description.className).not.toMatch(/(^| )sr-only( |$)/);
  });

  it('switches from a clicked row, and closes', () => {
    const { onChange } = open('diagram');
    fireEvent.pointerEnter(row('Draw'));
    fireEvent.click(row('Draw'));
    expect(onChange).toHaveBeenCalledWith('draw');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('switches from the keyboard: Enter on the focused row', () => {
    const { onChange } = open('diagram');
    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'Home' });
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(row('Draw'));
    fireEvent.keyDown(menu, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('draw');
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

// docs/specs/007-editor/editor-modes.md "Plan stands apart": across the line a row opens a new tab, except on an
// empty tab (a start panel's), where Plan is a plain switch.
describe('ModeMenu across Plan’s line', () => {
  it('marks Plan as a new tab on a tab with content, and its row opens one', async () => {
    const { onChange, newTabIn } = open('diagram');
    expect(row('Plan').querySelector('[data-new-tab-mark]')).not.toBeNull();
    expect(row('Draw').querySelector('[data-new-tab-mark]')).toBeNull();
    expect(
      document.getElementById(row('Plan').getAttribute('aria-describedby')!)?.textContent,
    ).toContain('Opens in a new tab.');
    fireEvent.click(row('Plan'));
    await vi.waitFor(() => expect(newTabIn).toHaveBeenCalledWith('plan'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('switches straight into Plan on an empty tab (crossPlan), with no new-tab mark', () => {
    const { onChange, newTabIn } = open('diagram', { crossPlan: true });
    expect(row('Plan').querySelector('[data-new-tab-mark]')).toBeNull();
    fireEvent.click(row('Plan'));
    expect(onChange).toHaveBeenCalledWith('plan');
    expect(newTabIn).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('switches out of Plan on an empty Plan tab too', () => {
    const { onChange } = open('plan', { crossPlan: true });
    fireEvent.click(row('Diagram'));
    expect(onChange).toHaveBeenCalledWith('diagram');
  });

  it('leaves a row inert when it can neither switch nor open a tab', () => {
    const onChange = vi.fn();
    render(
      <ModeMenuChip
        mode="plan"
        onChange={onChange}
        lockedReason="A Dashboard is always in Plan."
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /mode:/ }));
    expect(row('Draw').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(row('Draw'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeTruthy();
  });
});

describe('ModeMenu on a start panel', () => {
  it('opens from the named chip, which the Leave Illustrate confirmation hangs from', () => {
    open('draw');
    const chip = screen.getByRole('button', { name: 'Tab mode: Draw' });
    expect(chip.textContent).toContain('Draw');
    expect(chip.hasAttribute('data-mode-switch')).toBe(true);
    expect(preview().dataset.modePreview).toBe('draw');
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(5);
  });
});
