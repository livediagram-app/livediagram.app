// @vitest-environment jsdom
// The Quick Style bar (docs/specs/008-canvas/quick-style-panel.md "Where it sits", "Sections", "Accessibility"): a
// toolbar beside the selection's page's title bar, one button per row, each opening its row in a popover.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuickStyleApi } from '@/hooks/canvas/useQuickStyle';
import {
  clearQuickStyleBarSlot,
  setQuickStyleBarSlot,
  useQuickStyleBarRoom,
  useQuickStylePhoneRows,
} from '@/lib/quick-style-bar-slots';
import { QuickStyleBar } from './QuickStyleBar';

let mobile = false;
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => mobile,
}));

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
const open = (name: string) => {
  const button = within(bar()).getByRole('button', { name });
  // A real press: another popover open closes on it as a press outside.
  fireEvent.pointerDown(button);
  fireEvent.mouseDown(button);
  fireEvent.click(button);
  return screen.getByRole('dialog', { name });
};

describe('QuickStyleBar', () => {
  it("sits in the selection's page's slot, one named button per row in order, and no Clear Styles", () => {
    render(<QuickStyleBar quickStyle={api()} pageId="p1" hidden={false} />);
    expect(slot.contains(bar())).toBe(true);
    const names = within(bar())
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Stroke', 'Fill', 'Text', 'Width', 'Line', 'Align', 'Icon']);
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
    const buttons = within(bar()).getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['Text']);
    expect(buttons[0]!.textContent).toBe('A');
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
      seen.push(useQuickStylePhoneRows('p1'));
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

  it('draws each value on its button: chips for colours, the glyph in force, mixed muted', () => {
    render(<QuickStyleBar quickStyle={api()} pageId="p1" hidden={false} />);
    const button = (name: string) => within(bar()).getByRole('button', { name });
    expect(button('Stroke').querySelector('[data-chip]')).not.toBeNull();
    const paint = (name: string) =>
      button(name).querySelector('[data-chip]')!.getAttribute('data-paint');
    expect(paint('Stroke')).toBe('#1c1917');
    expect(paint('Fill')).toBe('transparent');
    expect(paint('Text')).toBe('mixed');
    expect(button('Width').querySelector('[data-mixed]')).toBeNull();
    expect(button('Line').querySelector('[data-mixed]')).not.toBeNull();
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
    expect(
      within(bar()).getByRole('button', { name: 'Stroke' }).getAttribute('aria-expanded'),
    ).toBe('true');
    fireEvent.click(strokeRow[3]!);
    expect(quickStyle.setStroke).toHaveBeenCalledWith(3);
    // The popover stays for another pick.
    expect(screen.getByRole('dialog', { name: 'Stroke' })).toBeTruthy();

    const fill = open('Fill');
    expect(screen.queryByRole('dialog', { name: 'Stroke' })).toBeNull();
    fireEvent.click(within(fill).getByRole('button', { name: 'Transparent' }));
    expect(quickStyle.setBackground).toHaveBeenCalledWith('transparent');

    const text = open('Text');
    expect(within(text).getByText('Text colour')).toBeTruthy();
    fireEvent.click(within(text).getByRole('button', { name: 'Ink' }));
    expect(quickStyle.setTextColour).toHaveBeenCalledWith('ink');
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
    expect(document.activeElement).toBe(within(bar()).getByRole('button', { name: 'Width' }));
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

  it("opens no browser menu on it, and keeps an article's toolbar", () => {
    render(<QuickStyleBar quickStyle={api()} pageId="p1" hidden={false} />);
    expect(fireEvent.contextMenu(bar())).toBe(false);
    expect(bar().dataset.articleKeepActive).toBe('');
  });

  it('publishes the room it takes beside the title bar, and gives it back as it goes', () => {
    const seen: number[] = [];
    const room = () => seen.at(-1);
    function Room() {
      seen.push(useQuickStyleBarRoom('p1'));
      return null;
    }
    const { rerender } = render(
      <>
        <Room />
        <QuickStyleBar quickStyle={api()} pageId="p1" hidden={false} />
      </>,
    );
    // jsdom lays nothing out: the bar's width is 0, so the room is the gap alone.
    expect(room()).toBe(6);
    act(() => {
      rerender(
        <>
          <Room />
          <QuickStyleBar quickStyle={api()} pageId="p1" hidden />
        </>,
      );
    });
    expect(room()).toBe(0);
  });
});
