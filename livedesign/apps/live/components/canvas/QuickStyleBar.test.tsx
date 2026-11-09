// @vitest-environment jsdom
// The Quick Style bar (docs/specs/008-canvas/quick-style-panel.md "Where it sits", "Sections", "Accessibility"): a
// toolbar beside its page's title bar, one button per row, each opening its row in a popover.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFreehand, type Element } from '@livedesign/design';
import type { QuickStyleApi } from '@/hooks/canvas/useQuickStyle';
import type { QuickStyleView } from '@/lib/quick-style';
import { heldPenStyle, strokesPenStyle } from '@/lib/quick-style-pen';
import { strokesHighlighterStyle, toolHighlighterStyle } from '@/lib/quick-style-highlighter';
import { DEFAULT_WHITEBOARD_PREFS } from '@/lib/whiteboard-prefs';
import {
  clearQuickStyleBarSlot,
  setQuickStyleBarSlot,
  useQuickStyleBarRoom,
  useQuickStylePhoneRows,
} from '@/lib/quick-style-bar-slots';
import { track } from '@/lib/telemetry';
import { QuickStyleBar } from './QuickStyleBar';

let mobile = false;
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => mobile,
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const swatches = Array.from({ length: 7 }, (_, slot) => ({
  slot: slot as 0,
  name: slot === 0 ? 'Theme default' : `Colour ${slot}`,
  color: '#0ea5e9',
}));

function api(
  sections: Partial<NonNullable<QuickStyleApi['view']>['sections']> = {},
): QuickStyleApi {
  return {
    view: {
      targetIds: ['a'],
      sections: {
        stroke: { value: 'ink', swatches, ink: '#1c1917', paint: '#1c1917' },
        background: { value: 0, swatches, paint: 'transparent' },
        textColour: { value: null, swatches, ink: '#1c1917', paint: null },
        width: { value: 'medium' },
        style: { value: null, options: ['solid', 'dashed', 'dotted'] },
        textAlign: { value: 'left' },
        iconAlign: { value: 'above' },
        ...sections,
      },
    },
    setStroke: vi.fn(),
    setBackground: vi.fn(),
    setWidth: vi.fn(),
    setStrokeStyle: vi.fn(),
    setTextAlign: vi.fn(),
    setIconAlign: vi.fn(),
    setTextColour: vi.fn(),
    setPenColour: vi.fn(),
    setPenWidth: vi.fn(),
    setHighlighterColour: vi.fn(),
    setHighlighterWidth: vi.fn(),
    clearStyles: vi.fn(),
    setSwatchOverride: vi.fn(),
    clearSwatchOverride: vi.fn(),
    setColour: vi.fn(),
  };
}

let slot: HTMLDivElement;
beforeEach(() => {
  mobile = false;
  slot = document.createElement('div');
  slot.dataset.testid = 'slot';
  document.body.appendChild(slot);
  setQuickStyleBarSlot('p1', { el: slot, named: true });
});
afterEach(() => {
  cleanup();
  clearQuickStyleBarSlot('p1', slot);
  slot.remove();
});

const bar = () => screen.getByRole('toolbar', { name: 'Quick Style' });
const names = () =>
  within(bar())
    .getAllByRole('button')
    .map((b) => b.getAttribute('aria-label'));
const button = (name: string) => within(bar()).getByRole('button', { name });
const paintOf = (name: string) =>
  button(name).querySelector('[data-chip]')!.getAttribute('data-paint');
const open = (name: string) => {
  const trigger = button(name);
  // A real press: another popover open closes on it as a press outside.
  fireEvent.pointerDown(trigger);
  fireEvent.mouseDown(trigger);
  fireEvent.click(trigger);
  return screen.getByRole('dialog', { name });
};

describe('QuickStyleBar', () => {
  it("sits in its page's slot, one named button per row in order, and no Clear Styles", () => {
    render(<QuickStyleBar quickStyle={api()} pageId="p1" hidden={false} />);
    expect(slot.contains(bar())).toBe(true);
    expect(names()).toEqual(['Stroke', 'Fill', 'Text', 'Width', 'Line', 'Align', 'Icon']);
    // Named beside their icons while the title bar is.
    expect(within(bar()).getByText('Fill')).toBeTruthy();
    expect(screen.queryByText('Clear Styles')).toBeNull();
    for (const b of within(bar()).getAllByRole('button')) {
      expect(b.getAttribute('aria-haspopup')).toBe('dialog');
      expect(b.getAttribute('aria-expanded')).toBe('false');
    }
  });

  it('shows only the rows that apply, and drops to icons when the title bar does', () => {
    const quickStyle = api();
    quickStyle.view = {
      targetIds: ['t'],
      sections: { textColour: { value: 0, swatches, ink: '#1c1917', paint: '#0ea5e9' } },
    };
    setQuickStyleBarSlot('p1', { el: slot, named: false });
    render(<QuickStyleBar quickStyle={quickStyle} pageId="p1" hidden={false} />);
    expect(names()).toEqual(['Text']);
    expect(button('Text').textContent).toBe('A');
  });

  it('stands down when hidden, on a phone, with no page or no view', () => {
    const { rerender } = render(<QuickStyleBar quickStyle={api()} pageId="p1" hidden />);
    expect(screen.queryByRole('toolbar')).toBeNull();
    rerender(<QuickStyleBar quickStyle={api()} pageId={null} hidden={false} />);
    expect(screen.queryByRole('toolbar')).toBeNull();
    rerender(<QuickStyleBar quickStyle={{ ...api(), view: null }} pageId="p1" hidden={false} />);
    expect(screen.queryByRole('toolbar')).toBeNull();
    // A page whose row has not drawn: nowhere to sit.
    rerender(<QuickStyleBar quickStyle={api()} pageId="p2" hidden={false} />);
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  // docs/specs/008-canvas/quick-style-panel.md "On a phone, in Appearance".
  it("on a phone gives its rows to the page's Appearance, each opening its own sheet", () => {
    mobile = true;
    const seen: ReturnType<typeof useQuickStylePhoneRows>[] = [];
    const rows = () => seen.at(-1) ?? null;
    function Appearance() {
      seen.push(useQuickStylePhoneRows());
      return null;
    }
    const quickStyle = api();
    const { rerender } = render(
      <>
        <Appearance />
        <QuickStyleBar quickStyle={quickStyle} pageId="p1" hidden={false} />
      </>,
    );
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(rows()!.pageId).toBe('p1');
    expect(rows()!.rows.map((r) => [r.name, r.line])).toEqual([
      ['Stroke', 'The outline colour'],
      ['Fill', 'The colour inside'],
      ['Text', 'The colour of the words'],
      ['Width', 'Thin, medium or thick'],
      ['Line', 'Solid, dashed or dotted'],
      ['Align', 'Left, centre or right'],
      ['Icon', 'Before, above or after the label'],
    ]);
    act(() => rows()!.open('width'));
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'QuickStyleWidth');
    const sheet = screen.getByRole('dialog', { name: 'Stroke width' });
    // The sheet's heading names the row, so the row shows no title of its own.
    expect(within(sheet).getAllByText('Stroke width')).toHaveLength(1);
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Thick' }));
    expect(quickStyle.setWidth).toHaveBeenCalledWith('thick');
    act(() => rows()!.open('nothing'));
    rerender(
      <>
        <Appearance />
        <QuickStyleBar quickStyle={quickStyle} pageId="p1" hidden />
      </>,
    );
    expect(rows()).toBeNull();
  });

  it("on a phone keeps a marker's In hand line in its untitled sheet", () => {
    mobile = true;
    const seen: ReturnType<typeof useQuickStylePhoneRows>[] = [];
    function Appearance() {
      seen.push(useQuickStylePhoneRows());
      return null;
    }
    const phone = () => seen.at(-1) ?? null;
    const pen = heldPenStyle(DEFAULT_WHITEBOARD_PREFS.pens[1]!, { board: 'light', ink: '#1c1917' });
    render(
      <>
        <Appearance />
        <QuickStyleBar
          quickStyle={{ ...api(), view: { targetIds: [], sections: {}, pen } }}
          pageId="p1"
          hidden={false}
        />
      </>,
    );
    expect(phone()!.rows.map((r) => r.name)).toEqual(['Marker', 'Size']);
    act(() => phone()!.open('penWidth'));
    const sheet = screen.getByRole('dialog', { name: 'Marker width' });
    expect(within(sheet).getByText('In hand: Marker 2')).toBeTruthy();
    expect(within(sheet).getAllByText('Marker width')).toHaveLength(1);
  });

  it('draws each value on its button: chips for colours, the glyph in force, mixed muted', () => {
    render(<QuickStyleBar quickStyle={api()} pageId="p1" hidden={false} />);
    expect(paintOf('Stroke')).toBe('#1c1917');
    expect(paintOf('Fill')).toBe('transparent');
    expect(paintOf('Text')).toBe('mixed');
    expect(button('Width').querySelector('[data-mixed]')).toBeNull();
    expect(button('Line').querySelector('[data-mixed]')).not.toBeNull();
    expect(button('Align').querySelector('[data-mixed]')).toBeNull();
    expect(button('Icon').querySelector('[data-mixed]')).toBeNull();
  });

  it('mutes every glyph button while the selection disagrees', () => {
    render(
      <QuickStyleBar
        quickStyle={api({
          width: { value: null },
          style: { value: 'flowing', options: ['solid', 'dashed', 'flowing'] },
          textAlign: { value: null },
          iconAlign: { value: null },
        })}
        pageId="p1"
        hidden={false}
      />,
    );
    for (const name of ['Width', 'Align', 'Icon'])
      expect(button(name).querySelector('[data-mixed]'), name).not.toBeNull();
    expect(button('Line').querySelector('[data-mixed]')).toBeNull();
  });

  it('opens a row in a named popover, titled, with Ink, Transparent and More colours', () => {
    const quickStyle = api();
    render(<QuickStyleBar quickStyle={quickStyle} pageId="p1" hidden={false} />);
    const stroke = open('Stroke');
    expect(within(stroke).getByText('Stroke')).toBeTruthy();
    const strokeRow = within(stroke).getAllByRole('button');
    expect(strokeRow).toHaveLength(9);
    expect(strokeRow[7]!.getAttribute('aria-label')).toBe('Ink');
    expect(strokeRow[7]!.getAttribute('aria-pressed')).toBe('true');
    expect(strokeRow[8]!.getAttribute('aria-label')).toBe('More colours, stroke');
    expect(button('Stroke').getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(strokeRow[3]!);
    expect(quickStyle.setStroke).toHaveBeenCalledWith(3);
    fireEvent.click(strokeRow[7]!);
    expect(quickStyle.setStroke).toHaveBeenCalledWith('ink');
    // The popover stays for another pick.
    expect(screen.getByRole('dialog', { name: 'Stroke' })).toBeTruthy();

    const fill = open('Fill');
    expect(screen.queryByRole('dialog', { name: 'Stroke' })).toBeNull();
    fireEvent.click(within(fill).getByRole('button', { name: 'Transparent' }));
    expect(quickStyle.setBackground).toHaveBeenCalledWith('transparent');
    fireEvent.click(within(fill).getByRole('button', { name: 'Colour 2' }));
    expect(quickStyle.setBackground).toHaveBeenCalledWith(2);
    // Transparent has no colour to edit.
    fireEvent.contextMenu(within(fill).getByRole('button', { name: 'Transparent' }));
    expect(screen.queryByRole('dialog', { name: /Custom colour/ })).toBeNull();

    const text = open('Text');
    expect(within(text).getByText('Text colour')).toBeTruthy();
    fireEvent.click(within(text).getByRole('button', { name: 'Ink' }));
    expect(quickStyle.setTextColour).toHaveBeenCalledWith('ink');
  });

  // docs/specs/004-interface-design/colour-picker.md "Skins".
  it("picks any colour from a row's More colours: a stock name on a line, a hex on a fill", () => {
    const quickStyle = api({ stroke: { value: 2, swatches, ink: '#1c1917', paint: '#0ea5e9' } });
    render(<QuickStyleBar quickStyle={quickStyle} pageId="p1" hidden={false} />);
    fireEvent.click(within(open('Stroke')).getByRole('button', { name: 'More colours, stroke' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'More colours, stroke' })).getByRole('button', {
        name: 'Teal',
      }),
    );
    expect(quickStyle.setColour).toHaveBeenCalledWith('stroke', 'teal');
    fireEvent.click(within(open('Fill')).getByRole('button', { name: 'More colours, fill' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'More colours, fill' })).getByRole('button', {
        name: 'Teal',
      }),
    );
    expect(quickStyle.setColour).toHaveBeenLastCalledWith(
      'fill',
      expect.stringMatching(/^#[0-9a-f]{6}$/),
    );
  });

  it('chooses the glyph rows from their popovers', () => {
    const quickStyle = api();
    render(<QuickStyleBar quickStyle={quickStyle} pageId="p1" hidden={false} />);
    fireEvent.click(within(open('Width')).getByRole('radio', { name: 'Thick' }));
    expect(quickStyle.setWidth).toHaveBeenCalledWith('thick');
    fireEvent.click(within(open('Line')).getByRole('radio', { name: 'Dotted' }));
    expect(quickStyle.setStrokeStyle).toHaveBeenCalledWith('dotted');
    fireEvent.click(within(open('Align')).getByRole('radio', { name: 'Align right' }));
    expect(quickStyle.setTextAlign).toHaveBeenCalledWith('right');
    fireEvent.click(within(open('Icon')).getByRole('radio', { name: 'Icon after label' }));
    expect(quickStyle.setIconAlign).toHaveBeenCalledWith('right');
  });

  it('closes its popover on Escape, focus back on the button', () => {
    render(<QuickStyleBar quickStyle={api()} pageId="p1" hidden={false} />);
    open('Width');
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(button('Width'));
  });

  it("edits a theme swatch's custom colour from its popover, which stays open under it", () => {
    const quickStyle = api();
    render(<QuickStyleBar quickStyle={quickStyle} pageId="p1" hidden={false} />);
    const stroke = open('Stroke');
    // Ink has no custom colour.
    fireEvent.contextMenu(within(stroke).getByRole('button', { name: 'Ink' }));
    expect(screen.queryByRole('dialog', { name: /Custom colour/ })).toBeNull();
    fireEvent.contextMenu(within(stroke).getByRole('button', { name: 'Colour 4' }));
    const editor = screen.getByRole('dialog', { name: 'Custom colour for Colour 4, Stroke' });
    fireEvent.pointerDown(editor);
    fireEvent.mouseDown(editor);
    expect(screen.getByRole('dialog', { name: 'Stroke' })).toBeTruthy();
    const hex = within(editor).getByLabelText('Hex');
    fireEvent.change(hex, { target: { value: '#123456' } });
    fireEvent.keyDown(hex, { key: 'Enter' });
    expect(quickStyle.setSwatchOverride).toHaveBeenCalledWith('stroke', 4, '#123456');
    // Escape closes the editor alone.
    fireEvent.contextMenu(within(stroke).getByRole('button', { name: 'Colour 4' }));
    fireEvent.keyDown(screen.getByRole('dialog', { name: /Custom colour/ }), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /Custom colour/ })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Stroke' })).toBeTruthy();
  });

  it('clears an override from the custom colour popover, and lets it go with its row', () => {
    const custom = swatches.map((s) =>
      s.slot === (4 as number)
        ? { ...s, name: 'Custom red', override: { themeColor: '#0ea5e9', themeName: 'Colour 4' } }
        : s,
    );
    const quickStyle = api({
      stroke: { value: null, swatches: custom, ink: '#1c1917', paint: null },
    });
    const { rerender } = render(
      <QuickStyleBar quickStyle={quickStyle} pageId="p1" hidden={false} />,
    );
    fireEvent.contextMenu(within(open('Stroke')).getByRole('button', { name: 'Custom red' }));
    const editor = screen.getByRole('dialog', { name: 'Custom colour for Colour 4, Stroke' });
    fireEvent.click(within(editor).getByRole('button', { name: 'Clear override' }));
    expect(quickStyle.clearSwatchOverride).toHaveBeenCalledWith('stroke', 4);
    // The selection no longer has a Stroke row: the editor goes with it.
    const { stroke: _gone, ...rest } = quickStyle.view!.sections;
    rerender(
      <QuickStyleBar
        quickStyle={{ ...quickStyle, view: { targetIds: ['a'], sections: rest } }}
        pageId="p1"
        hidden={false}
      />,
    );
    expect(screen.queryByRole('dialog', { name: /Custom colour/ })).toBeNull();
  });

  it('opens no browser menu on it, and its presses never reach the canvas', () => {
    const onCanvas = vi.fn();
    document.body.addEventListener('pointerdown', onCanvas);
    document.body.addEventListener('dblclick', onCanvas);
    render(<QuickStyleBar quickStyle={api()} pageId="p1" hidden={false} />);
    expect(fireEvent.contextMenu(bar())).toBe(false);
    fireEvent.pointerDown(bar());
    fireEvent.doubleClick(bar());
    expect(onCanvas).not.toHaveBeenCalled();
    document.body.removeEventListener('pointerdown', onCanvas);
    document.body.removeEventListener('dblclick', onCanvas);
  });

  it('counts each popover it opens', () => {
    render(<QuickStyleBar quickStyle={api()} pageId="p1" hidden={false} />);
    open('Fill');
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'QuickStyleFill');
  });

  it('publishes the room it takes beside the title bar, and gives it back as it goes', () => {
    const rooms: number[] = [];
    function Room() {
      const r = useQuickStyleBarRoom();
      rooms.push(r?.pageId === 'p1' ? r.px : 0);
      return null;
    }
    const { rerender } = render(
      <>
        <Room />
        <QuickStyleBar quickStyle={api()} pageId="p1" hidden={false} />
      </>,
    );
    // jsdom lays nothing out: the bar's width is 0, so the room is the gap alone.
    expect(rooms.at(-1)).toBe(8);
    act(() => {
      rerender(
        <>
          <Room />
          <QuickStyleBar quickStyle={api()} pageId="p1" hidden />
        </>,
      );
    });
    expect(rooms.at(-1)).toBe(0);
  });
});

const PALETTE = { board: 'light' as const, ink: '#1c1917' };
const withView = (view: QuickStyleView): QuickStyleApi => ({ ...api(), view });
const freehand = (id: string, extra: Record<string, unknown>) =>
  ({
    ...createFreehand(
      [
        { x: 0, y: 0 },
        { x: 9, y: 9 },
      ],
      false,
    ),
    id,
    ...extra,
  }) as Element;

// docs/specs/023-draw-mode/drawing-tools.md "The Quick Style bar".
describe('QuickStyleBar: the marker buttons', () => {
  const second = heldPenStyle(DEFAULT_WHITEBOARD_PREFS.pens[1]!, PALETTE);

  it('styles the marker in hand, saying so, with nothing selected', () => {
    const quickStyle = withView({ targetIds: [], sections: {}, pen: second });
    render(<QuickStyleBar quickStyle={quickStyle} pageId="p1" hidden={false} />);
    expect(names()).toEqual(['Marker', 'Size']);
    // The colour in force on the Marker button; the width on Size.
    expect(paintOf('Marker')).toBe(second.colour.options.find((o) => o.value === 'blue')!.swatch);
    expect(button('Size').querySelector('[data-mixed]')).toBeNull();
    const colour = open('Marker');
    expect(within(colour).getByText('Marker colour')).toBeTruthy();
    expect(within(colour).getByText('In hand: Marker 2')).toBeTruthy();
    expect(
      within(colour)
        .getAllByRole('button')
        .map((r) => r.getAttribute('aria-label')),
    ).toEqual([
      'Ink',
      'Red',
      'Orange',
      'Yellow',
      'Green',
      'Teal',
      'Blue',
      'Violet',
      'Pink',
      'More colours, marker colour',
    ]);
    fireEvent.click(within(colour).getByRole('button', { name: 'Red' }));
    expect(quickStyle.setPenColour).toHaveBeenCalledWith('red');
    const width = within(open('Size')).getByRole('radiogroup', { name: 'Marker width' });
    expect(
      within(width)
        .getAllByRole('radio')
        .map((r) => r.getAttribute('aria-label')),
    ).toEqual(['Fine', 'Medium', 'Bold', 'Thick', 'Heavy', 'Broad']);
    fireEvent.click(within(width).getByRole('radio', { name: 'Broad' }));
    expect(quickStyle.setPenWidth).toHaveBeenCalledWith('broad');
  });

  it('gives Marker 1 its one colour, the ink', () => {
    const first = heldPenStyle(DEFAULT_WHITEBOARD_PREFS.pens[0]!, PALETTE);
    render(
      <QuickStyleBar
        quickStyle={withView({ targetIds: [], sections: {}, pen: first })}
        pageId="p1"
        hidden={false}
      />,
    );
    expect(within(open('Marker')).getAllByRole('button')).toHaveLength(1);
  });

  it('styles selected strokes first on the bar, a custom colour drawn as itself, mixed widths muted', () => {
    const strokes = strokesPenStyle(
      [
        freehand('a', { penWidth: 1.5, strokeColor: '#AA0000' }),
        freehand('b', { penWidth: 2.5, strokeColor: '#aa0000' }),
      ],
      PALETTE,
    )!;
    const quickStyle = api();
    quickStyle.view = { ...quickStyle.view!, pen: strokes };
    render(<QuickStyleBar quickStyle={quickStyle} pageId="p1" hidden={false} />);
    expect(names().slice(0, 3)).toEqual(['Marker', 'Size', 'Stroke']);
    expect(paintOf('Marker')).toBe('#aa0000');
    expect(button('Size').querySelector('[data-mixed]')).not.toBeNull();
    // A selection, not a tool in hand: no In hand line.
    expect(within(open('Marker')).queryByText(/In hand/)).toBeNull();
  });

  it('draws a split dot when the strokes disagree, or a stock name it cannot draw', () => {
    const disagree = strokesPenStyle(
      [freehand('a', { penWidth: 1.5 }), freehand('b', { penWidth: 1.5, penColour: 'red' })],
      PALETTE,
    )!;
    const { unmount } = render(
      <QuickStyleBar
        quickStyle={withView({ targetIds: [], sections: {}, pen: disagree })}
        pageId="p1"
        hidden={false}
      />,
    );
    expect(paintOf('Marker')).toBe('mixed');
    unmount();
    const unknown = { ...disagree, colour: { value: 'grey', options: disagree.colour.options } };
    render(
      <QuickStyleBar
        quickStyle={withView({ targetIds: [], sections: {}, pen: unknown })}
        pageId="p1"
        hidden={false}
      />,
    );
    expect(paintOf('Marker')).toBe('mixed');
  });
});

// docs/specs/008-canvas/highlighter.md "Settings".
describe('QuickStyleBar: the Highlighter buttons', () => {
  it('sets the armed Highlighter’s next stroke, saying so', () => {
    const quickStyle = withView({
      targetIds: [],
      sections: {},
      highlighter: toolHighlighterStyle('#fde047', 14),
    });
    render(<QuickStyleBar quickStyle={quickStyle} pageId="p1" hidden={false} />);
    expect(names()).toEqual(['Highlighter', 'Thickness']);
    expect(paintOf('Highlighter')).toBe('#fde047');
    const colour = open('Highlighter');
    expect(within(colour).getByText('In hand: Highlighter')).toBeTruthy();
    expect(
      within(colour).getByRole('button', { name: 'Yellow' }).getAttribute('aria-pressed'),
    ).toBe('true');
    fireEvent.click(within(colour).getByRole('button', { name: 'Pink' }));
    expect(quickStyle.setHighlighterColour).toHaveBeenCalledWith('#f9a8d4');
    const width = within(open('Thickness')).getByRole('radiogroup', {
      name: 'Highlighter width',
    });
    expect(within(width).getByRole('radio', { name: 'Medium' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.click(within(width).getByRole('radio', { name: 'Bold' }));
    expect(quickStyle.setHighlighterWidth).toHaveBeenCalledWith('bold');
  });

  it('styles selected highlights without an In hand line, mixed widths muted', () => {
    const highlights = strokesHighlighterStyle([
      freehand('a', { pen: 'highlighter', strokeColor: '#fde047' }),
      freehand('b', { pen: 'highlighter', strokeColor: '#fde047', penWidth: 22 }),
    ])!;
    render(
      <QuickStyleBar
        quickStyle={withView({ targetIds: [], sections: {}, highlighter: highlights })}
        pageId="p1"
        hidden={false}
      />,
    );
    expect(button('Thickness').querySelector('[data-mixed]')).not.toBeNull();
    expect(within(open('Thickness')).queryByText(/In hand/)).toBeNull();
  });
});
