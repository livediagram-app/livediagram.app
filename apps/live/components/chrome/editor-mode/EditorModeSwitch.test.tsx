// @vitest-environment jsdom

// The mode switch (docs/specs/007-editor/editor-modes.md "The mode switch"): an icon-only dropdown
// chip, the same for everyone, reading the editor's resolved mode from EditorModeProvider;
// nothing where no switch is offered.

import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EDITOR_MODES,
  ES_BOARD_LAYER_ID,
  editorModeLabel,
  type EditorMode,
  type Tab,
} from '@livediagram/document';
import { useEditorMode, type EditorModeState } from '@/hooks/editor/useEditorMode';
import { EditorModeProvider } from './editor-mode-context';
import { EditorModeSwitch } from './EditorModeSwitch';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderSwitch(mode: EditorMode, over: Partial<EditorModeState> = {}) {
  const onChange = vi.fn<(mode: EditorMode) => void>();
  const view = render(
    <EditorModeProvider
      value={{ mode, setMode: onChange, canSwitch: true, canEdit: true, ...over }}
    >
      <EditorModeSwitch />
    </EditorModeProvider>,
  );
  return { onChange, ...view };
}

const slot = (container: HTMLElement) => container.querySelector('[data-editor-mode-switch]');
const chip = () => screen.getByRole('button', { name: /^Editor mode:/ });

describe('EditorModeSwitch chip', () => {
  it.each(EDITOR_MODES)('is a collapsed menu button named after %s', (mode) => {
    renderSwitch(mode);
    expect(chip().getAttribute('aria-label')).toBe(`Editor mode: ${editorModeLabel(mode)}`);
    expect(chip().getAttribute('aria-haspopup')).toBe('menu');
    expect(chip().getAttribute('aria-expanded')).toBe('false');
    expect(chip().getAttribute('aria-keyshortcuts')).toBe('Shift+D');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('shows the current mode as an icon, no words', () => {
    renderSwitch('diagram');
    expect(chip().textContent).toBe('');
    expect(chip().querySelectorAll('svg').length).toBeGreaterThan(0);
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
      expect.stringMatching(/^Illustrate/),
      expect.stringMatching(/^Plan/),
    ]);
    expect(rows.map((row) => row.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
      'false',
    ]);
    expect(document.activeElement).toBe(rows[1]);
  });

  it('keeps each row to its icon and name, no description', () => {
    renderSwitch('diagram');
    fireEvent.click(chip());
    expect(screen.queryByText('Shapes, arrows, the palette and snapping.')).toBeNull();
    expect(screen.getAllByRole('menuitemradio').map((row) => row.textContent)).toEqual([
      'Diagram',
      'Draw⇧D',
      'Illustrate',
      'Plan',
    ]);
  });

  it('shows Shift+D on the row it leads to', () => {
    renderSwitch('diagram');
    fireEvent.click(chip());
    const [diagram, draw] = screen.getAllByRole('menuitemradio');
    expect(diagram!.textContent).not.toContain('⇧D');
    expect(draw!.textContent).toContain('⇧D');
  });

  it.each(['ArrowDown', 'ArrowUp'])('opens from the keyboard with %s', (key) => {
    renderSwitch('diagram');
    fireEvent.keyDown(chip(), { key });
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('moves focus with ArrowDown, ArrowUp, Home and End, wrapping around', () => {
    renderSwitch('diagram');
    fireEvent.click(chip());
    const menu = screen.getByRole('menu');
    const [diagram, draw, illustrate, plan] = screen.getAllByRole('menuitemradio');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(draw);
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(illustrate);
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(plan);
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(diagram);
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(plan);
    fireEvent.keyDown(menu, { key: 'Home' });
    expect(document.activeElement).toBe(diagram);
    fireEvent.keyDown(menu, { key: 'End' });
    expect(document.activeElement).toBe(plan);
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
    // Escape from inside the menu, where opening put the focus.
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(chip());
  });

  // Safari does not focus a pressed button: pressing a row blurs the focused row to nowhere first.
  it('keeps the menu open through a blur to nowhere, so the pressed row still switches', () => {
    const { onChange } = renderSwitch('draw');
    fireEvent.click(chip());
    const [diagram, draw] = screen.getAllByRole('menuitemradio');
    fireEvent.focusOut(draw!, { relatedTarget: null });
    expect(screen.queryByRole('menu')).not.toBeNull();
    fireEvent.click(diagram!);
    expect(onChange).toHaveBeenCalledWith('diagram');
  });

  it('closes when focus moves outside (Tab away)', () => {
    renderSwitch('diagram');
    const outside = document.createElement('button');
    document.body.append(outside);
    fireEvent.click(chip());
    fireEvent.focusOut(screen.getAllByRole('menuitemradio')[0]!, { relatedTarget: outside });
    expect(screen.queryByRole('menu')).toBeNull();
    outside.remove();
  });

  it('closes on a press outside', () => {
    renderSwitch('diagram');
    fireEvent.click(chip());
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens downward, from the left edge', () => {
    renderSwitch('diagram');
    fireEvent.click(chip());
    expect(screen.getByRole('menu').className).toMatch(/left-0 top-full/);
  });
});

describe('EditorModeSwitch slot', () => {
  it('keeps one width across both modes (zero layout shift)', () => {
    const widths = new Set<string>();
    for (const mode of EDITOR_MODES) {
      widths.add(slot(renderSwitch(mode).container)!.className);
      cleanup();
    }
    expect(widths.size).toBe(1);
  });

  it('renders nothing outside an editor', () => {
    const { container } = render(<EditorModeSwitch />);
    expect(container.innerHTML).toBe('');
  });
});

// The switch reads the editor's own resolution (useEditorMode), as EditorView provides it.
describe('EditorModeSwitch in the editor', () => {
  let seq = 0;
  const freshTab = (over: Partial<Tab> = {}): Tab => {
    seq += 1;
    return { id: `sw${seq}`, name: 'Tab', elements: [], ...over };
  };
  // The tab held as the editor holds it: a switch commits onto it and re-renders.
  function Host({ tab: initial, canEdit = true }: { tab: Tab; canEdit?: boolean }) {
    const [tabs, setTabs] = useState([initial]);
    const editorMode = useEditorMode(tabs[0], {
      canEdit,
      commitTabs: (map) => setTabs((ts) => map(ts)),
      toastInfo: () => {},
    });
    return (
      <EditorModeProvider value={editorMode}>
        <EditorModeSwitch />
      </EditorModeProvider>
    );
  }

  it("shows the tab's mode, and switches the tab from the menu", () => {
    render(<Host tab={freshTab({ opensIn: 'draw' })} />);
    expect(chip().getAttribute('aria-label')).toBe('Editor mode: Draw');
    fireEvent.click(chip());
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Diagram/ }));
    expect(chip().getAttribute('aria-label')).toBe('Editor mode: Diagram');
  });

  // docs/specs/007-editor/live-app.md#role-pill: previewing as a viewer, an editor is a viewer.
  it('offers a visitor who cannot edit no switch', () => {
    const { container } = render(<Host tab={freshTab()} canEdit={false} />);
    expect(slot(container)).toBeNull();
  });

  it('offers no switch on an event-storming board, nor a legacy one known by its layer', () => {
    const { container } = render(<Host tab={freshTab({ kind: 'event-storming' })} />);
    expect(slot(container)).toBeNull();
    cleanup();
    const layers = [{ id: ES_BOARD_LAYER_ID, name: 'Board', visible: true }];
    const legacy = render(<Host tab={freshTab({ layers })} />);
    expect(slot(legacy.container)).toBeNull();
  });
});
