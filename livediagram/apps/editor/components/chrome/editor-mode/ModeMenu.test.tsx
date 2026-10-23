// @vitest-environment jsdom

// The mode menu (docs/specs/007-editor/editor-modes.md "The mode switch"): a list of the modes and a
// preview of one, following the pointer, else focus, else the current mode. The preview has no button:
// choosing is the row's alone. It opens from a start panel's named chip.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { editorModeDescription, type EditorMode } from '@livediagram/document';
import { ModeMenuChip } from './ModeMenuChip';
import { MODE_TOOLS } from './mode-menu-copy';

afterEach(cleanup);

function open(
  mode: EditorMode,
  over: Partial<Parameters<typeof ModeMenuChip>[0]> = {},
): { onChange: ReturnType<typeof vi.fn> } {
  const onChange = vi.fn();
  render(<ModeMenuChip mode={mode} onChange={onChange} {...over} />);
  fireEvent.click(screen.getByRole('button', { name: /mode:/ }));
  return { onChange };
}

const preview = () => document.querySelector<HTMLElement>('[data-mode-preview]')!;
const row = (name: string) => screen.getByRole('menuitemradio', { name: new RegExp(`^${name}`) });

describe('ModeMenu preview', () => {
  it('shows the current mode until a row is pointed at, then follows the pointer', () => {
    open('diagram');
    expect(preview().dataset.modePreview).toBe('diagram');
    expect(preview().textContent).toContain(editorModeDescription('diagram'));
    for (const tool of MODE_TOOLS.diagram) expect(preview().textContent).toContain(tool);

    fireEvent.pointerEnter(row('Workshop'));
    expect(preview().dataset.modePreview).toBe('workshop');
    expect(preview().textContent).toContain(editorModeDescription('workshop'));
  });

  it('follows keyboard focus too', () => {
    open('diagram');
    fireEvent.focus(row('Draw'));
    expect(preview().dataset.modePreview).toBe('draw');
  });

  it('is hidden from assistive technology and holds no button', () => {
    open('diagram');
    expect(preview().getAttribute('aria-hidden')).toBe('true');
    fireEvent.pointerEnter(row('Workshop'));
    expect(preview().querySelector('button')).toBeNull();
    expect(preview().textContent).not.toContain('Switch to');
    // The menu's items are its rows alone.
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(3);
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

describe('ModeMenu choosing', () => {
  it('switches straight to another mode', () => {
    const { onChange } = open('diagram');
    fireEvent.click(row('Draw'));
    expect(onChange).toHaveBeenCalledWith('draw');
  });
});

describe('ModeMenu on a start panel', () => {
  it('opens from the named chip', () => {
    open('draw');
    const chip = screen.getByRole('button', { name: 'Tab mode: Draw' });
    expect(chip.textContent).toContain('Draw');
    expect(preview().dataset.modePreview).toBe('draw');
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(3);
  });
});
