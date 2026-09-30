// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_WHITEBOARD_PREFS } from '@/lib/whiteboard-prefs';
import { dockModel as model, renderDock } from './dock-test-utils';

const itemsOf = (group: string) =>
  [
    ...document.querySelectorAll<HTMLElement>(
      `[data-dock-group="${group}"] [data-dock-item], [data-dock-group="${group}"] [data-pinned-separator]`,
    ),
  ].map((el) => el.dataset.dockItem ?? '|');

describe('WhiteboardDock groups', () => {
  it('is four labelled horizontal toolbars, each one tab stop', () => {
    renderDock();
    const bars = screen.getAllByRole('toolbar');
    expect(bars.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Drawing tools',
      'Shapes',
      'History',
      'Settings',
    ]);
    for (const bar of bars) {
      expect(bar.getAttribute('aria-orientation')).toBe('horizontal');
      expect(bar.querySelectorAll('[data-dock-item][tabindex="0"]')).toHaveLength(1);
    }
  });

  it('lays out Select, the markers, Text, Path tool and Eraser as the drawing tools', () => {
    renderDock();
    expect(itemsOf('drawing')).toEqual([
      'select',
      'main',
      'second',
      'third',
      'text',
      'path',
      'eraser',
    ]);
    expect(screen.queryByRole('button', { name: 'Sticky note' })).toBeNull();
  });

  it('gives the cog a group of its own, last', () => {
    renderDock();
    expect(itemsOf('settings')).toEqual(['settings']);
    const bars = screen.getAllByRole('toolbar');
    expect(bars[bars.length - 1]!.getAttribute('aria-label')).toBe('Settings');
  });

  it('lays out the shapes bar as the pinned shapes, a separator and Shapes', () => {
    renderDock(model('select', { pinnedShapes: ['star'] }));
    expect(itemsOf('shapes')).toEqual(['pinned:star', '|', 'shapes']);
  });

  it('walks one group with the arrow keys, wrapping, and Home / End, never into the next', () => {
    renderDock();
    const select = screen.getByRole('button', { name: 'Select' });
    select.focus();
    fireEvent.keyDown(select, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Marker 1, medium' }));
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Eraser' }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(select);
    fireEvent.keyDown(select, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Eraser' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(document.activeElement).toBe(select);
  });

  it('moves the tab stop to the last focused button of its group', () => {
    renderDock();
    const path = screen.getByRole('button', { name: 'Path tool' });
    act(() => path.focus());
    expect(path.getAttribute('tabindex')).toBe('0');
    expect(screen.getByRole('button', { name: 'Text' }).getAttribute('tabindex')).toBe('-1');
    // The other groups keep their own stops.
    expect(screen.getByRole('button', { name: 'Select' }).getAttribute('tabindex')).toBe('-1');
    expect(screen.getByRole('button', { name: 'Undo' }).getAttribute('tabindex')).toBe('0');
  });
});

describe('WhiteboardDock scrolling', () => {
  it('keeps an open flyout over its button as the groups scroll', () => {
    let cogLeft = 400;
    const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      const left = (this as HTMLElement).dataset.dockItem === 'settings' ? cogLeft : 0;
      return {
        left,
        right: left + 44,
        width: 44,
        top: 0,
        bottom: 44,
        height: 44,
        x: left,
        y: 0,
        toJSON: () => ({}),
      };
    });
    try {
      renderDock();
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
      const flyout = () => document.getElementById('whiteboard-flyout-settings');
      expect(flyout()!.style.left).toBe('422px');
      cogLeft = 250;
      fireEvent.scroll(document.querySelector('[data-dock-scroller]')!);
      expect(flyout()!.style.left).toBe('272px');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('WhiteboardDock history', () => {
  it('offers Undo and Redo in its own group, on every layout', () => {
    const { onUndo } = renderDock();
    const history = screen.getByRole('toolbar', { name: 'History' });
    fireEvent.click(within(history).getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalled();
  });

  it('marks Undo and Redo unavailable with nothing to do, and ignores a press', () => {
    const { onRedo } = renderDock(model(), { canUndo: false, canRedo: false });
    const redo = screen.getByRole('button', { name: 'Redo' });
    expect(redo.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('button', { name: 'Undo' }).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(redo);
    expect(onRedo).not.toHaveBeenCalled();
  });
});

describe('WhiteboardDock drawing tools', () => {
  it('names each pen by colour and width and marks the one in hand', () => {
    renderDock();
    expect(
      screen.getByRole('button', { name: 'Marker 1, medium' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      screen.getByRole('button', { name: 'Marker 2, blue, medium' }).getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('draws a marker holding the ink in the ink, glyph and name alike', () => {
    // docs/specs/023-whiteboard/whiteboard.md "The colour picker": any marker may take the ink.
    const pens = DEFAULT_WHITEBOARD_PREFS.pens.map((p) =>
      p.id === 'second' ? { ...p, colour: null } : p,
    );
    renderDock(model('pen', { prefs: { ...DEFAULT_WHITEBOARD_PREFS, pens } }));
    const button = screen.getByRole('button', { name: 'Marker 2, ink, medium' });
    expect(button.querySelector('path[fill]')!.getAttribute('fill')).toBe('#1c1917');
  });

  it('picks a pen, and opens its flyout when it is already in hand', () => {
    const { m } = renderDock();
    fireEvent.click(screen.getByRole('button', { name: 'Marker 2, blue, medium' }));
    expect(m.pickPen).toHaveBeenCalledWith('second');
    expect(screen.queryByRole('group', { name: 'Marker 1' })).toBeNull();
    const ink = screen.getByRole('button', { name: 'Marker 1, medium' });
    fireEvent.click(ink);
    expect(m.pickPen).toHaveBeenCalledTimes(1);
    expect(ink.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('group', { name: 'Marker 1' })).toBeTruthy();
  });

  it('keeps the main pen its default colour: its flyout is the width only', () => {
    const { m } = renderDock();
    fireEvent.click(screen.getByRole('button', { name: 'Marker 1, medium' }));
    expect(screen.queryByText('Colour')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(m.updatePen).toHaveBeenCalledWith('main', { width: 2.5 });
  });

  it('changes the colour and width of an adjustable pen from its flyout', () => {
    const { m } = renderDock(
      model('pen', { prefs: { ...DEFAULT_WHITEBOARD_PREFS, activePenId: 'second' } }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Marker 2, blue, medium' }));
    // The colour picker (docs/specs/023-whiteboard/whiteboard.md "The colour picker"): the eight stock colours.
    expect(screen.getByTestId('stock-colours').querySelectorAll('button')).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: 'Violet' }));
    expect(m.updatePen).toHaveBeenCalledWith('second', { colour: 'violet' });
    fireEvent.click(screen.getByRole('button', { name: 'Fine' }));
    expect(m.updatePen).toHaveBeenCalledWith('second', { width: 1 });
  });

  it('closes a flyout on Escape and hands focus back to its opener', () => {
    renderDock();
    const ink = screen.getByRole('button', { name: 'Marker 1, medium' });
    fireEvent.click(ink);
    const group = screen.getByRole('group', { name: 'Marker 1' });
    expect(group.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Marker 1' })).toBeNull();
    expect(document.activeElement).toBe(ink);
  });

  it('switches the eraser between Stroke and Partial', () => {
    const { m } = renderDock(model('eraser'));
    fireEvent.click(screen.getByRole('button', { name: 'Eraser' }));
    fireEvent.click(screen.getByRole('button', { name: /Partial/ }));
    expect(m.setEraserMode).toHaveBeenCalledWith('partial');
  });

  it('picks Text from the drawing tools', () => {
    const { m } = renderDock();
    const text = within(screen.getByRole('toolbar', { name: 'Drawing tools' })).getByRole(
      'button',
      {
        name: 'Text',
      },
    );
    fireEvent.click(text);
    expect(m.pickText).toHaveBeenCalled();
  });

  it('shows edit mode on Select, which leaves it when pressed', () => {
    const { m } = renderDock(model('select', { pathEditing: true }));
    const select = screen.getByRole('button', { name: 'Select, editing a path' });
    expect(select.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(select);
    expect(m.leavePathEdit).toHaveBeenCalled();
    expect(m.pickSelect).not.toHaveBeenCalled();
  });

  it('has no highlighter', () => {
    renderDock();
    expect(screen.queryByRole('button', { name: 'Highlighter' })).toBeNull();
  });

  it('resets a pen to how it started on a right-click, without picking it up', () => {
    const m = model();
    renderDock(m);
    const second = screen.getByRole('button', { name: /^Marker 2/ });
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    second.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(m.resetPen).toHaveBeenCalledWith('second');
    expect(m.pickPen).not.toHaveBeenCalled();
  });

  it('names each tool key in aria-keyshortcuts', () => {
    renderDock();
    const keyOf = (name: RegExp) =>
      screen.getByRole('button', { name }).getAttribute('aria-keyshortcuts');
    expect(keyOf(/^Select/)).toBe('V');
    expect(keyOf(/^Marker 1/)).toBe('1');
    expect(keyOf(/^Marker 2/)).toBe('2');
    expect(keyOf(/^Marker 3/)).toBe('3');
    expect(keyOf(/^Path tool/)).toBe('P');
    expect(keyOf(/^Eraser/)).toBe('E');
    expect(keyOf(/^Text/)).toBe('T');
  });
});

describe('WhiteboardDock settings', () => {
  it('opens on a press, never on hover', () => {
    renderDock();
    const cog = screen.getByRole('button', { name: 'Settings' });
    fireEvent.pointerEnter(cog, { pointerType: 'mouse' });
    expect(screen.queryByRole('group', { name: 'Settings' })).toBeNull();
    fireEvent.click(cog);
    expect(screen.getByRole('group', { name: 'Settings' })).toBeTruthy();
    expect(cog.getAttribute('aria-expanded')).toBe('true');
  });

  it('heads Background, Cursor and Drawing, not a title of its own', () => {
    renderDock();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const settings = screen.getByRole('group', { name: 'Settings' });
    const headings = [...settings.querySelectorAll('[data-flyout-heading]')].map(
      (h) => h.textContent,
    );
    expect(headings).toEqual(['Background', 'Cursor', 'Drawing']);
  });

  it('sets the board background', () => {
    const { m } = renderDock();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('button', { name: 'Plain' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Grid' }));
    expect(m.setBackground).toHaveBeenCalledWith('grid');
  });

  it('switches the pen cursor between the dot and the crosshair with a nib', () => {
    const { m } = renderDock();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const row = screen.getByRole('group', { name: 'Cursor' });
    const options = within(row).getAllByRole('button');
    expect(options.map((b) => b.getAttribute('aria-label'))).toEqual(['Crosshair + nib', 'Dot']);
    expect(options[0]!.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(row).getByRole('button', { name: 'Dot' }));
    expect(m.setCursor).toHaveBeenCalledWith('dot');
  });

  it('switches Drawing between Basic and Shape recognition', () => {
    const { m } = renderDock();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const row = screen.getByRole('group', { name: 'Drawing' });
    const recognise = within(row).getByRole('button', { name: 'Shape recognition' });
    expect(within(row).getByRole('button', { name: 'Basic' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(recognise);
    expect(m.setRecognition).toHaveBeenCalledWith(true);
  });

  it('closes on a press outside, without taking focus', () => {
    vi.useFakeTimers();
    try {
      renderDock();
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
      act(() => {
        document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      });
      expect(screen.queryByRole('group', { name: 'Settings' })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
