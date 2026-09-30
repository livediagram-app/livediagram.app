// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_WHITEBOARD_PREFS } from '@/lib/whiteboard-prefs';
import type { WhiteboardTool } from '@/lib/whiteboard-tool';
import type { WhiteboardDockModel } from '@/hooks/canvas/useWhiteboard';
import { WhiteboardDock } from './WhiteboardDock';

function model(tool: WhiteboardTool = 'pen', over: Partial<WhiteboardDockModel> = {}) {
  return {
    whiteboard: true,
    tool,
    prefs: DEFAULT_WHITEBOARD_PREFS,
    activePen: DEFAULT_WHITEBOARD_PREFS.pens[0]!,
    background: 'blank' as const,
    pickSelect: vi.fn(),
    pickPen: vi.fn(),
    updatePen: vi.fn(),
    resetPen: vi.fn(),
    pickEraser: vi.fn(),
    setEraserMode: vi.fn(),
    pickSticky: vi.fn(),
    pickText: vi.fn(),
    pickShape: vi.fn(),
    setRecognition: vi.fn(),
    setCursor: vi.fn(),
    setBackground: vi.fn(),
    ...over,
  } as WhiteboardDockModel;
}

function renderDock(m = model(), extra: { canUndo?: boolean; showHistory?: boolean } = {}) {
  const onUndo = vi.fn();
  render(
    <WhiteboardDock
      model={m}
      ink="#1c1917"
      canUndo={extra.canUndo ?? true}
      showHistory={extra.showHistory}
      canRedo={false}
      onUndo={onUndo}
      onRedo={vi.fn()}
    />,
  );
  return { m, onUndo };
}

describe('WhiteboardDock', () => {
  it('is a labelled horizontal toolbar with one tab stop', () => {
    renderDock();
    const bar = screen.getByRole('toolbar', { name: 'Whiteboard tools' });
    expect(bar.getAttribute('aria-orientation')).toBe('horizontal');
    const stops = bar.querySelectorAll('button[tabindex="0"]');
    expect(stops).toHaveLength(1);
  });

  it('names each pen by colour and width and marks the one in hand', () => {
    renderDock();
    expect(
      screen.getByRole('button', { name: 'Main pen, medium' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      screen.getByRole('button', { name: 'Second pen, blue, medium' }).getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('moves between buttons with the arrow keys, wrapping, and Home / End', () => {
    renderDock();
    const select = screen.getByRole('button', { name: 'Select' });
    select.focus();
    fireEvent.keyDown(select, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Main pen, medium' }));
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'More' }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(select);
    fireEvent.keyDown(select, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'More' }));
  });

  it('picks a pen, and opens its flyout when it is already in hand', () => {
    const { m } = renderDock();
    fireEvent.click(screen.getByRole('button', { name: 'Second pen, blue, medium' }));
    expect(m.pickPen).toHaveBeenCalledWith('second');
    expect(screen.queryByRole('group', { name: 'Main pen' })).toBeNull();
    const ink = screen.getByRole('button', { name: 'Main pen, medium' });
    fireEvent.click(ink);
    expect(m.pickPen).toHaveBeenCalledTimes(1);
    expect(ink.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('group', { name: 'Main pen' })).toBeTruthy();
  });

  it('offers the main pen, then the second and third pens', () => {
    renderDock();
    const pens = screen
      .getAllByRole('button', { name: / pen, / })
      .map((b) => b.getAttribute('aria-label'));
    expect(pens).toEqual([
      'Main pen, medium',
      'Second pen, blue, medium',
      'Third pen, red, medium',
    ]);
  });

  it('keeps the main pen its default colour: its flyout is the width only', () => {
    const { m } = renderDock();
    fireEvent.click(screen.getByRole('button', { name: 'Main pen, medium' }));
    expect(screen.queryByText('Colour')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(m.updatePen).toHaveBeenCalledWith('main', { width: 2.5 });
  });

  it('changes the colour and width of an adjustable pen from its flyout', () => {
    const { m } = renderDock(
      model('pen', { prefs: { ...DEFAULT_WHITEBOARD_PREFS, activePenId: 'second' } }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Second pen, blue, medium' }));
    fireEvent.click(screen.getByRole('button', { name: 'Violet' }));
    expect(m.updatePen).toHaveBeenCalledWith('second', { colour: '#9061f9' });
    fireEvent.click(screen.getByRole('button', { name: 'Fine' }));
    expect(m.updatePen).toHaveBeenCalledWith('second', { width: 1 });
  });

  it('closes a flyout on Escape and hands focus back to its opener', () => {
    renderDock();
    const ink = screen.getByRole('button', { name: 'Main pen, medium' });
    fireEvent.click(ink);
    const group = screen.getByRole('group', { name: 'Main pen' });
    expect(group.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Main pen' })).toBeNull();
    expect(document.activeElement).toBe(ink);
  });

  it('switches the eraser between Stroke and Partial', () => {
    const { m } = renderDock(model('eraser'));
    fireEvent.click(screen.getByRole('button', { name: 'Eraser' }));
    fireEvent.click(screen.getByRole('button', { name: /Partial/ }));
    expect(m.setEraserMode).toHaveBeenCalledWith('partial');
  });

  it('picks a shape from the shapes flyout and closes it', () => {
    const { m } = renderDock();
    fireEvent.click(screen.getByRole('button', { name: 'Shapes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Diamond' }));
    expect(m.pickShape).toHaveBeenCalledWith('diamond');
    expect(screen.queryByRole('group', { name: 'Shapes' })).toBeNull();
  });

  it('sets the board background from More', () => {
    const { m } = renderDock();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('button', { name: 'Plain' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Grid' }));
    expect(m.setBackground).toHaveBeenCalledWith('grid');
  });

  it('heads More with Background, Drawing and Cursor, not a title of its own', () => {
    renderDock();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const more = screen.getByRole('group', { name: 'More' });
    const headings = [...more.querySelectorAll('[data-flyout-heading]')].map((h) => h.textContent);
    expect(headings).toEqual(['Background', 'Drawing', 'Cursor']);
  });

  it('switches the pen cursor between the dot and the crosshair with a nib', () => {
    const { m } = renderDock();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const row = screen.getByRole('group', { name: 'Cursor' });
    expect(
      within(row).getByRole('button', { name: 'Crosshair + nib' }).getAttribute('aria-pressed'),
    ).toBe('true');
    fireEvent.click(within(row).getByRole('button', { name: 'Dot' }));
    expect(m.setCursor).toHaveBeenCalledWith('dot');
  });

  it('switches Drawing between Basic and Shape recognition', () => {
    const { m } = renderDock();
    expect(screen.queryByRole('button', { name: 'Shape recognition' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const row = screen.getByRole('group', { name: 'Drawing' });
    const basic = within(row).getByRole('button', { name: 'Basic' });
    const recognise = within(row).getByRole('button', { name: 'Shape recognition' });
    expect(basic.getAttribute('aria-pressed')).toBe('true');
    expect(recognise.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(recognise);
    expect(m.setRecognition).toHaveBeenCalledWith(true);
  });

  it('opens Shapes on hover and closes it a moment after the pointer leaves', () => {
    vi.useFakeTimers();
    try {
      renderDock();
      const shapes = screen.getByRole('button', { name: 'Shapes' });
      fireEvent.pointerEnter(shapes, { pointerType: 'mouse' });
      expect(screen.getByRole('group', { name: 'Shapes' })).toBeTruthy();
      // Hovering never takes the keyboard focus away from the board.
      expect(screen.getByRole('group', { name: 'Shapes' }).contains(document.activeElement)).toBe(
        false,
      );
      fireEvent.pointerLeave(shapes, { pointerType: 'mouse' });
      // Crossing the gap into the flyout keeps it open.
      fireEvent.pointerEnter(screen.getByRole('group', { name: 'Shapes' }), {
        pointerType: 'mouse',
      });
      act(() => vi.advanceTimersByTime(1000));
      expect(screen.getByRole('group', { name: 'Shapes' })).toBeTruthy();
      fireEvent.pointerLeave(screen.getByRole('group', { name: 'Shapes' }), {
        pointerType: 'mouse',
      });
      act(() => vi.advanceTimersByTime(1000));
      expect(screen.queryByRole('group', { name: 'Shapes' })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not open Shapes for a finger passing over it', () => {
    renderDock();
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Shapes' }), {
      pointerType: 'touch',
    });
    expect(screen.queryByRole('group', { name: 'Shapes' })).toBeNull();
  });

  it('has no highlighter', () => {
    renderDock();
    expect(screen.queryByRole('button', { name: 'Highlighter' })).toBeNull();
  });

  it('draws a picked shape with the pen in hand', () => {
    const { m } = renderDock();
    fireEvent.click(screen.getByRole('button', { name: 'Shapes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rectangle' }));
    expect(m.pickShape).toHaveBeenCalledWith('rectangle');
  });

  it('disables Undo when there is nothing to undo', () => {
    renderDock(model(), { canUndo: false });
    expect((screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('WhiteboardDock keys', () => {
  it('names each tool key in aria-keyshortcuts', () => {
    renderDock();
    const keyOf = (name: RegExp) =>
      screen.getByRole('button', { name }).getAttribute('aria-keyshortcuts');
    expect(keyOf(/^Select/)).toBe('V');
    expect(keyOf(/^Main pen/)).toBe('1');
    expect(keyOf(/^Second pen/)).toBe('2');
    expect(keyOf(/^Third pen/)).toBe('3');
    expect(keyOf(/^Eraser/)).toBe('E');
    expect(keyOf(/^Sticky note/)).toBe('N');
    expect(keyOf(/^Text/)).toBe('T');
  });

  it('offers rectangle, ellipse, diamond, cylinder, line and arrow with their keys, and no triangle', () => {
    renderDock();
    fireEvent.click(screen.getByRole('button', { name: 'Shapes' }));
    const group = screen.getByRole('group', { name: 'Shapes' });
    const options = [...group.querySelectorAll('button')].map((b) => [
      b.getAttribute('aria-label'),
      b.getAttribute('aria-keyshortcuts'),
    ]);
    expect(options).toEqual([
      ['Rectangle', 'R'],
      ['Ellipse', 'O'],
      ['Diamond', 'D'],
      ['Cylinder', 'C'],
      ['Line', 'L'],
      ['Arrow', 'A'],
    ]);
  });
});

describe('WhiteboardDock extras', () => {
  it('resets a pen to how it started on a right-click, without picking it up', () => {
    const m = model();
    renderDock(m);
    const second = screen.getByRole('button', { name: /^Second pen/ });
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    second.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(m.resetPen).toHaveBeenCalledWith('second');
    expect(m.pickPen).not.toHaveBeenCalled();
  });

  it('leaves Undo and Redo out when the corner cluster carries them', () => {
    renderDock(model(), { showHistory: false });
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Redo' })).toBeNull();
    expect(screen.getByRole('button', { name: 'More' })).toBeTruthy();
  });
});
