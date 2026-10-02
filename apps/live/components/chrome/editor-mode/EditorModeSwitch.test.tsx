// @vitest-environment jsdom

// The mode switch (docs/specs/007-editor/editor-modes.md "The mode switch"): a dropdown chip for
// everyone, an icon-only segmented pill in power user mode
// (docs/specs/007-editor/power-user-mode.md "Quick mode switch").

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EDITOR_MODES, type EditorMode } from '@livediagram/document';
import { EditorModeSwitch } from './EditorModeSwitch';

afterEach(cleanup);

function renderSwitch(mode: EditorMode, { compact = false, hidden = false } = {}) {
  const onChange = vi.fn<(mode: EditorMode) => void>();
  const view = render(
    <EditorModeSwitch compact={compact} mode={mode} onChange={onChange} hidden={hidden} />,
  );
  return { onChange, ...view };
}

const slot = (container: HTMLElement) => container.querySelector('[data-editor-mode-switch]')!;

describe('EditorModeSwitch chip', () => {
  const chip = () => screen.getByRole('button', { name: /^Editor mode:/ });

  it.each(EDITOR_MODES)('is a collapsed menu button named after %s', (mode) => {
    renderSwitch(mode);
    expect(chip().getAttribute('aria-label')).toBe(
      `Editor mode: ${mode === 'draw' ? 'Draw' : 'Diagram'}`,
    );
    expect(chip().getAttribute('aria-haspopup')).toBe('menu');
    expect(chip().getAttribute('aria-expanded')).toBe('false');
    expect(chip().getAttribute('aria-keyshortcuts')).toBe('Shift+D');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens a menu of every mode, in catalogue order, focusing the checked one', () => {
    renderSwitch('draw');
    fireEvent.click(chip());
    expect(chip().getAttribute('aria-expanded')).toBe('true');
    screen.getByRole('menu', { name: 'Editor mode' });
    const rows = screen.getAllByRole('menuitemradio');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringMatching(/^Diagram/),
      expect.stringMatching(/^Draw/),
    ]);
    expect(rows.map((row) => row.getAttribute('aria-checked'))).toEqual(['false', 'true']);
    expect(document.activeElement).toBe(rows[1]);
  });

  it('shows each description in full', () => {
    renderSwitch('diagram');
    fireEvent.click(chip());
    screen.getByText('Shapes, arrows, the palette and snapping.');
    screen.getByText('Pens, the eraser and shape recognition.');
  });

  it('shows Shift+D on the row it leads to', () => {
    renderSwitch('diagram');
    fireEvent.click(chip());
    const [diagram, draw] = screen.getAllByRole('menuitemradio');
    expect(diagram!.textContent).not.toContain('⇧D');
    expect(draw!.textContent).toContain('⇧D');
  });

  it('opens from the keyboard with ArrowUp', () => {
    renderSwitch('diagram');
    fireEvent.keyDown(chip(), { key: 'ArrowUp' });
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('moves focus with ArrowDown, ArrowUp, Home and End, wrapping around', () => {
    renderSwitch('diagram');
    fireEvent.click(chip());
    const menu = screen.getByRole('menu');
    const [diagram, draw] = screen.getAllByRole('menuitemradio');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(draw);
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(diagram);
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(draw);
    fireEvent.keyDown(menu, { key: 'Home' });
    expect(document.activeElement).toBe(diagram);
    fireEvent.keyDown(menu, { key: 'End' });
    expect(document.activeElement).toBe(draw);
  });

  it.each([
    ['diagram', 'Draw', 'draw'],
    ['draw', 'Diagram', 'diagram'],
  ] as const)('from %s, choosing %s switches, closes and refocuses the chip', (from, row, to) => {
    const { onChange } = renderSwitch(from);
    fireEvent.click(chip());
    fireEvent.click(screen.getByRole('menuitemradio', { name: new RegExp(`^${row}`) }));
    expect(onChange).toHaveBeenCalledWith(to);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(chip());
  });

  it('closes without choosing on the current row', () => {
    const { onChange } = renderSwitch('diagram');
    fireEvent.click(chip());
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Diagram/ }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on Escape and returns focus to the chip', () => {
    renderSwitch('diagram');
    fireEvent.click(chip());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(chip());
  });

  it('closes on a press outside', () => {
    renderSwitch('diagram');
    fireEvent.click(chip());
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('EditorModeSwitch icon pill (power user mode)', () => {
  const radio = (name: string) => screen.getByRole('radio', { name });

  it('is a radiogroup with one radio per mode, named by the mode', () => {
    renderSwitch('diagram', { compact: true });
    const group = screen.getByRole('radiogroup', { name: 'Editor mode' });
    expect(screen.getAllByRole('radio').every((r) => group.contains(r))).toBe(true);
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual([
      'Diagram',
      'Draw',
    ]);
  });

  it('shows icons only, no words', () => {
    renderSwitch('diagram', { compact: true });
    expect(screen.getByRole('radiogroup').textContent).toBe('');
  });

  it.each(EDITOR_MODES)('checks %s exactly when given it, with one tab stop there', (mode) => {
    renderSwitch(mode, { compact: true });
    for (const option of EDITOR_MODES) {
      const r = radio(option === 'draw' ? 'Draw' : 'Diagram');
      expect(r.getAttribute('aria-checked')).toBe(String(option === mode));
      expect(r.tabIndex).toBe(option === mode ? 0 : -1);
    }
  });

  it('advertises Shift+D on every segment', () => {
    renderSwitch('diagram', { compact: true });
    for (const r of screen.getAllByRole('radio')) {
      expect(r.getAttribute('aria-keyshortcuts')).toBe('Shift+D');
    }
  });

  it('selects the other mode on press and ignores a press on the checked one', () => {
    const { onChange } = renderSwitch('diagram', { compact: true });
    fireEvent.click(radio('Diagram'));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(radio('Draw'));
    expect(onChange).toHaveBeenCalledWith('draw');
  });

  it.each([
    ['ArrowRight', 'diagram', 'draw'],
    ['ArrowDown', 'diagram', 'draw'],
    ['ArrowLeft', 'draw', 'diagram'],
    ['ArrowUp', 'draw', 'diagram'],
    ['ArrowRight', 'draw', 'diagram'],
    ['ArrowLeft', 'diagram', 'draw'],
  ] as const)('moves focus and selection with %s from %s', (key, from, to) => {
    const { onChange } = renderSwitch(from, { compact: true });
    const current = screen.getByRole('radio', { checked: true });
    current.focus();
    fireEvent.keyDown(current, { key });
    expect(onChange).toHaveBeenCalledWith(to);
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      to === 'draw' ? 'Draw' : 'Diagram',
    );
  });

  it('ignores keys that are not arrows', () => {
    const { onChange } = renderSwitch('diagram', { compact: true });
    fireEvent.keyDown(radio('Diagram'), { key: 'x' });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('EditorModeSwitch slot', () => {
  it('keeps one width across both modes and both forms (zero layout shift)', () => {
    const widths = new Set<string>();
    for (const compact of [false, true]) {
      for (const mode of EDITOR_MODES) {
        const { container } = renderSwitch(mode, { compact });
        widths.add(slot(container).className);
        cleanup();
      }
    }
    expect(widths.size).toBe(1);
  });

  it.each([false, true])('hidden (compact %s) keeps the slot but offers no control', (compact) => {
    const shown = slot(renderSwitch('diagram', { compact }).container).className;
    cleanup();
    const hidden = slot(renderSwitch('diagram', { compact, hidden: true }).container);
    expect(hidden.className).toBe(shown);
    expect(hidden.getAttribute('aria-hidden')).toBe('true');
    expect(hidden.childElementCount).toBe(0);
  });
});
