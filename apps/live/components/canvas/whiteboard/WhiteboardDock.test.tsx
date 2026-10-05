// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_WHITEBOARD_PREFS } from '@/lib/whiteboard-prefs';
import { dockModel as model, renderDock } from './dock-test-utils';
import { PenWidthIcon } from './PenWidthIcon';
import { WhiteboardDock } from './WhiteboardDock';
import { besidePanel, offDock } from './WhiteboardFlyout';

const itemsOf = (group: string) =>
  [
    ...document.querySelectorAll<HTMLElement>(
      `[data-dock-group="${group}"] [data-dock-item], [data-dock-group="${group}"] [data-pinned-separator]`,
    ),
  ].map((el) => el.dataset.dockItem ?? '|');

describe('WhiteboardDock groups', () => {
  it('is three labelled horizontal toolbars, each one tab stop, with no Undo or Redo', () => {
    renderDock();
    const bars = screen.getAllByRole('toolbar');
    expect(bars.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Drawing tools',
      'Shapes',
      'Settings',
    ]);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Redo' })).toBeNull();
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
    expect(screen.getByRole('button', { name: 'Settings' }).getAttribute('tabindex')).toBe('0');
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
    // docs/specs/023-draw-mode/draw-mode.md "The colour picker": any marker may take the ink.
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
    // The colour picker (docs/specs/023-draw-mode/draw-mode.md "The colour picker"): the eight stock colours.
    expect(screen.getByTestId('stock-colours').querySelectorAll('button')).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: 'Violet' }));
    expect(m.updatePen).toHaveBeenCalledWith('second', { colour: 'violet' });
    fireEvent.click(screen.getByRole('button', { name: 'Fine' }));
    expect(m.updatePen).toHaveBeenCalledWith('second', { width: 1 });
  });

  // docs/specs/023-draw-mode/draw-mode.md "Pens": each width reads apart, drawn as the quick style
  // panel draws it (PenWidthIcon), not to scale, where 1 and 1.5 px looked the same.
  it('draws the three widths apart in the flyout, as the quick style panel does', () => {
    renderDock();
    fireEvent.click(screen.getByRole('button', { name: 'Marker 1, medium' }));
    const pictures = ['Fine', 'Medium', 'Bold'].map(
      (name) => screen.getByRole('button', { name }).querySelector('svg')!.outerHTML,
    );
    expect(new Set(pictures).size).toBe(3);
    const { container } = render(<PenWidthIcon width="fine" />);
    expect(container.querySelector('svg')!.outerHTML).toBe(pictures[0]);
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

  it('takes the focus on a press once it is shown, and Escape hands it back', () => {
    renderDock();
    // A browser will not focus a hidden element (jsdom will): record whether the flyout was shown
    // each time something inside it was focused.
    const shownAtFocus: boolean[] = [];
    const focus = HTMLElement.prototype.focus;
    const spy = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (
      this: HTMLElement,
      options?: FocusOptions,
    ) {
      const card = this.closest<HTMLElement>('#whiteboard-flyout-settings');
      if (card) shownAtFocus.push(card.style.visibility !== 'hidden');
      focus.call(this, options);
    });
    const cog = screen.getByRole('button', { name: 'Settings' });
    fireEvent.click(cog);
    spy.mockRestore();
    const settings = screen.getByRole('group', { name: 'Settings' });
    expect(shownAtFocus).toEqual([true]);
    expect(document.activeElement).toBe(within(settings).getByRole('button', { name: 'Plain' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Settings' })).toBeNull();
    expect(document.activeElement).toBe(cog);
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

  it('adds Colours last only while the board has custom colours to snap', () => {
    const snap = vi.fn(() => 2);
    renderDock(
      model('pen', { snapColours: { colours: ['#e03131', '#1971c2'], blocked: false, snap } }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const settings = screen.getByRole('group', { name: 'Settings' });
    const headings = [...settings.querySelectorAll('[data-flyout-heading]')].map(
      (h) => h.textContent,
    );
    expect(headings).toEqual(['Background', 'Cursor', 'Drawing', 'Colours']);
    fireEvent.click(screen.getByRole('button', { name: 'Snap to stock colours' }));
    expect(snap).toHaveBeenCalledTimes(1);
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

// docs/specs/023-draw-mode/draw-mode.md "Where the dock sits".
describe('WhiteboardDock position', () => {
  const dock = () => document.querySelector<HTMLElement>('[data-whiteboard-dock]')!;
  const SEVEN = ['arrow', 'rectangle', 'ellipse', 'diamond', 'cylinder', 'line', 'star'] as const;

  // Seven pinned and one more pinned from the Shapes flyout's menu: refused, so the hint shows.
  function refusePin() {
    fireEvent.click(screen.getByRole('button', { name: 'Shapes' }));
    fireEvent.contextMenu(screen.getAllByRole('option')[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Pin to dock' }));
    return document.querySelector<HTMLElement>('[data-dock-hint]')!;
  }

  it('sits at the top by default, its flyouts and hint opening below it', () => {
    renderDock(model('select', { pinnedShapes: [...SEVEN] }));
    expect(dock().dataset.dockPosition).toBe('top');
    expect(dock().className).toContain('top-3');
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const flyout = screen.getByRole('group', { name: 'Settings' });
    expect(flyout.dataset.side).toBe('below');
    // Portalled and fixed, so the toolbar UI scale never zooms it.
    expect(flyout.className).toContain('fixed');
    expect(dock().contains(flyout)).toBe(false);
    // Its tip points up at the button that opened it.
    expect(flyout.querySelector('[data-flyout-tip]')?.getAttribute('data-flyout-tip')).toBe('top');
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(refusePin().dataset.side).toBe('below');
  });

  it('sits at the bottom when chosen, its flyouts and hint opening above it', () => {
    renderDock(model('select', { position: 'bottom', pinnedShapes: [...SEVEN] }));
    expect(dock().dataset.dockPosition).toBe('bottom');
    expect(dock().className).toContain('bottom-[4.25rem]');
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const flyout = screen.getByRole('group', { name: 'Settings' });
    expect(flyout.dataset.side).toBe('above');
    expect(flyout.className).toContain('fixed');
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(refusePin().dataset.side).toBe('above');
  });

  it('keeps clear of the Explorer menu card (button + mode switch) at the top: beside it below lg, centred from lg', () => {
    renderDock();
    const cls = dock().className.split(' ');
    expect(cls).toEqual(
      expect.arrayContaining([
        'left-[8.25rem]',
        'max-w-[calc(100%-9rem)]',
        'lg:left-1/2',
        'lg:-translate-x-1/2',
        'lg:max-w-[calc(100%-15rem)]',
      ]),
    );
  });

  it('moves between top and bottom in place, keeping its groups', () => {
    const { view } = renderDock();
    const before = screen.getByRole('button', { name: 'Select' });
    view.rerender(<WhiteboardDock model={model('pen', { position: 'bottom' })} ink="#1c1917" />);
    expect(dock().dataset.dockPosition).toBe('bottom');
    expect(screen.getByRole('button', { name: 'Select' })).toBe(before);
  });
});

describe('WhiteboardDock position log', () => {
  it('logs the position once the dock is shown, and again when it moves', () => {
    const debug = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { view } = renderDock();
    expect(debug).toHaveBeenCalledWith('[whiteboard-dock] position', 'top');
    debug.mockClear();
    view.rerender(<WhiteboardDock model={model('pen', { position: 'bottom' })} ink="#1c1917" />);
    expect(debug).toHaveBeenCalledWith('[whiteboard-dock] position', 'bottom');
    debug.mockRestore();
  });
});

// docs/specs/023-draw-mode/draw-mode.md "What a whiteboard shows": the Floating layout's form.
describe('WhiteboardDock in the Palette panel', () => {
  const renderPanel = () =>
    render(<WhiteboardDock variant="panel" model={model()} ink="#1c1917" />);

  it('lays the same three groups out as the panel body, with no dock placement', () => {
    renderPanel();
    expect(screen.getAllByRole('toolbar').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Drawing tools',
      'Shapes',
      'Settings',
    ]);
    const body = document.querySelector<HTMLElement>('[data-whiteboard-dock]')!;
    expect(body.dataset.dockVariant).toBe('panel');
    expect(body.dataset.dockPosition).toBeUndefined();
    expect(body.className).not.toContain('absolute');
    // Sections wrap to the panel's width rather than sitting in pills of their own.
    // The palette's own three-column tile grid, each tile captioned.
    const drawing = screen.getByRole('toolbar', { name: 'Drawing tools' });
    expect(drawing.className).toContain('grid-cols-3');
    expect(within(drawing).getByRole('button', { name: /^Marker 1/ }).textContent).toBe('Marker 1');
  });

  it('captions each tile without its key letter (the key is in the tooltip)', () => {
    renderPanel();
    const drawing = screen.getByRole('toolbar', { name: 'Drawing tools' });
    expect(within(drawing).getByRole('button', { name: 'Path tool' }).textContent).toBe('Path');
    expect(within(drawing).getByRole('button', { name: 'Select' }).textContent).toBe('Select');
  });

  it('walks a tile grid by rows with ArrowUp and ArrowDown', () => {
    renderPanel();
    const drawing = screen.getByRole('toolbar', { name: 'Drawing tools' });
    const select = within(drawing).getByRole('button', { name: 'Select' });
    act(() => select.focus());
    // Select, Marker 1, Marker 2 / Marker 3, ...: three columns.
    fireEvent.keyDown(select, { key: 'ArrowDown' });
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^Marker 3/);
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(select);
  });

  it('draws no separators, and the cog as the footer row', () => {
    renderPanel();
    expect(document.querySelectorAll('.bg-slate-200.w-px')).toHaveLength(0);
    const footer = screen.getByRole('toolbar', { name: 'Settings' });
    expect(footer.className).toContain('border-t');
    expect(within(footer).getByRole('button', { name: 'Settings' }).textContent).toBe('Settings');
  });

  it('opens a flyout beside the panel, out of its scroll clip', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const flyout = document.getElementById('whiteboard-flyout-settings')!;
    expect(flyout.dataset.side).toBe('beside');
    expect(flyout.className).toContain('fixed');
    // Portalled to the body, not inside the panel.
    expect(document.querySelector('[data-whiteboard-dock]')!.contains(flyout)).toBe(false);
    // Its tip faces the panel.
    expect(flyout.querySelector('[data-flyout-tip]')?.getAttribute('data-flyout-tip')).toMatch(
      /^(left|right)$/,
    );
  });

  it('shows the Shapes menu items on the panel, with no Shapes menu', () => {
    renderPanel();
    const shapes = screen.getByRole('toolbar', { name: 'Shapes' });
    expect(within(shapes).queryByRole('button', { name: 'Shapes' })).toBeNull();
    expect(shapes.querySelectorAll('[data-dock-item^="menu:"]').length).toBeGreaterThan(0);
  });
});

describe('offDock', () => {
  const flyout = { offsetWidth: 200, offsetHeight: 120 };
  const dockBox = { top: 12, bottom: 58 };

  it('opens on the board side of the dock, centred on its opener, the tip over it', () => {
    expect(offDock(dockBox, { left: 500, width: 36 }, flyout, true, { width: 1280 })).toEqual({
      left: 418,
      top: 66,
      tipLeft: 100,
    });
    // A dock at the bottom: above it.
    expect(
      offDock({ top: 700, bottom: 746 }, { left: 500, width: 36 }, flyout, false, { width: 1280 })
        .top,
    ).toBe(700 - 8 - 120);
  });

  it('stays in the viewport near an edge, its tip still over the opener', () => {
    const at = offDock(dockBox, { left: 10, width: 36 }, flyout, true, { width: 1280 });
    expect(at.left).toBe(12);
    expect(at.tipLeft).toBe(28 - 12);
  });
});

describe('besidePanel', () => {
  const viewport = { width: 1280, height: 800 };
  const flyout = { offsetWidth: 280, offsetHeight: 200 };

  it('opens on the side with more room, level with the opener', () => {
    // A panel at the right: the flyout opens to its left.
    expect(besidePanel({ left: 1000, right: 1260 }, { top: 120 }, flyout, viewport)).toMatchObject({
      left: 1000 - 22 - 280,
      top: 120,
      side: 'left',
    });
    // A panel at the left: to its right.
    expect(besidePanel({ left: 20, right: 280 }, { top: 120 }, flyout, viewport)).toMatchObject({
      left: 280 + 22,
      top: 120,
      side: 'right',
    });
  });

  it('puts the tip level with the opener, clear of the corners', () => {
    const at = (top: number, height = 36) =>
      besidePanel({ left: 1000, right: 1260 }, { top, height }, flyout, viewport).tipTop;
    expect(at(120)).toBe(18);
    // The card is pushed up from the bottom edge: the tip still finds the opener, within the card.
    expect(at(700)).toBe(700 + 18 - (800 - 12 - 200));
    expect(at(790)).toBe(200 - 14);
  });

  it('keeps the flyout inside the viewport', () => {
    expect(besidePanel({ left: 1000, right: 1260 }, { top: 700 }, flyout, viewport).top).toBe(
      800 - 12 - 200,
    );
    expect(besidePanel({ left: 100, right: 1200 }, { top: 0 }, flyout, viewport)).toMatchObject({
      left: 12,
      top: 12,
    });
  });
});
