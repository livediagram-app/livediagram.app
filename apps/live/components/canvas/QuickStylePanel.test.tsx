// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { QuickStyleView } from '@/lib/quick-style';
import { customOptions, heldPenStyle, stockOptions } from '@/lib/quick-style-pen';
import { toolHighlighterStyle } from '@/lib/quick-style-highlighter';
import { DEFAULT_WHITEBOARD_PREFS } from '@/lib/whiteboard-prefs';
import { describe, expect, it, vi } from 'vitest';
import { QuickRadioRow } from './quick-style-rows';
import { SwatchOverridePopover } from './SwatchOverridePopover';
import { QuickStylePanel, panelFrame } from './QuickStylePanel';
import { QUICK_ROW_TARGETS } from './quick-style-metrics';
import { MinimalChromeProvider } from '@/components/providers/minimal-chrome';

// The panel is desktop only; jsdom has no viewport to measure.
vi.mock('@/hooks/ui/useIsMobileViewport', () => ({ useIsMobileViewport: () => false }));
// Nor a canvas to place it on: a measured spot, so the panel is visible to role queries.
vi.mock('@/hooks/ui/useQuickStylePlacement', () => ({
  useQuickStylePlacement: () => ({ left: 12, top: 12, width: null }),
}));

// docs/specs/008-canvas/quick-style-panel.md "Accessibility": each row is a named radio group; arrows
// move and choose; one tab stop per row; titles are separate from the names.

const options = [
  { value: 'thin', name: 'Thin', content: null },
  { value: 'medium', name: 'Medium', content: null },
  { value: 'thick', name: 'Thick', content: null },
] as const;

function renderRow(value: 'thin' | 'medium' | 'thick' | null, showTitle = true) {
  const onChoose = vi.fn();
  render(
    <QuickRadioRow
      title="Stroke width"
      showTitle={showTitle}
      options={options}
      value={value}
      onChoose={onChoose}
      testId="row"
    />,
  );
  return onChoose;
}

describe('QuickRadioRow', () => {
  it('is a radio group named by its title, with named radios', () => {
    renderRow('medium');
    const group = screen.getByRole('radiogroup', { name: 'Stroke width' });
    expect(group).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Medium' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Thin' }).getAttribute('aria-checked')).toBe('false');
  });

  it('keeps its name when the visible title is hidden', () => {
    renderRow('medium', false);
    expect(screen.queryByText('Stroke width')).toBeNull();
    expect(screen.getByRole('radiogroup', { name: 'Stroke width' })).toBeTruthy();
  });

  it('has one tab stop: the checked option, else the first', () => {
    renderRow('thick');
    expect(screen.getByRole('radio', { name: 'Thick' }).tabIndex).toBe(0);
    expect(screen.getByRole('radio', { name: 'Thin' }).tabIndex).toBe(-1);
  });

  it('puts the tab stop on the first option when nothing is shared', () => {
    renderRow(null);
    expect(screen.getByRole('radio', { name: 'Thin' }).tabIndex).toBe(0);
  });

  it('moves and chooses with the arrow keys, wrapping, and Home / End', () => {
    const onChoose = renderRow('thick');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Thick' }), { key: 'ArrowRight' });
    expect(onChoose).toHaveBeenLastCalledWith('thin');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Thin' }), { key: 'ArrowLeft' });
    expect(onChoose).toHaveBeenLastCalledWith('thick');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Thin' }), { key: 'End' });
    expect(onChoose).toHaveBeenLastCalledWith('thick');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Thick' }), { key: 'Home' });
    expect(onChoose).toHaveBeenLastCalledWith('thin');
  });

  it('chooses on click', () => {
    const onChoose = renderRow('thin');
    fireEvent.click(screen.getByRole('radio', { name: 'Thick' }));
    expect(onChoose).toHaveBeenCalledWith('thick');
  });
});

describe('QuickRadioRow: custom swatches', () => {
  const swatches = [
    { value: 0, name: 'Theme default', content: null, swatch: '#dcfce7' },
    {
      value: 4,
      name: 'Custom orange, in place of Green',
      content: null,
      swatch: '#ff5500',
      overridden: true,
    },
  ];
  const renderSwatches = () => {
    const onOptionContext = vi.fn();
    render(
      <QuickRadioRow
        title="Stroke"
        showTitle
        options={swatches}
        value={null}
        onChoose={vi.fn()}
        onOptionContext={onOptionContext}
        testId="row"
      />,
    );
    return onOptionContext;
  };

  it('opens the swatch menu on right-click, Shift+F10 and the context-menu key', () => {
    const onOptionContext = renderSwatches();
    const custom = screen.getByRole('button', { name: 'Custom orange, in place of Green' });
    fireEvent.contextMenu(custom);
    fireEvent.keyDown(custom, { key: 'F10', shiftKey: true });
    fireEvent.keyDown(custom, { key: 'ContextMenu' });
    expect(onOptionContext).toHaveBeenCalledTimes(3);
    expect(onOptionContext).toHaveBeenLastCalledWith(4, custom);
  });

  it('marks an overridden swatch, and only that one', () => {
    renderSwatches();
    const custom = screen.getByRole('button', { name: 'Custom orange, in place of Green' });
    expect(custom.querySelector('[data-swatch-marker]')).not.toBeNull();
    expect(
      screen.getByRole('button', { name: 'Theme default' }).querySelector('[data-swatch-marker]'),
    ).toBeNull();
  });

  it('keeps every swatch a 24 px target, drawing a smaller chip inside it', () => {
    renderSwatches();
    const button = screen.getByRole('button', { name: 'Theme default' });
    expect(button.className).toContain('h-6 w-6');
    expect(button.firstElementChild!.className).toContain('h-5 w-5');
  });
});

describe('SwatchOverridePopover', () => {
  const setup = (overridden: boolean) => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    const onSave = vi.fn();
    const onClear = vi.fn();
    const onClose = vi.fn();
    render(
      <SwatchOverridePopover
        anchor={anchor}
        label="Custom colour for Green, Stroke"
        colour="#1a9e46"
        overridden={overridden}
        themeNote="Theme colour: Green"
        onSave={onSave}
        onClear={onClear}
        onClose={onClose}
      />,
    );
    return { anchor, onSave, onClear, onClose };
  };

  it('is a labelled dialog that saves a typed hex on Enter', () => {
    const { onSave } = setup(false);
    expect(screen.getByRole('dialog', { name: 'Custom colour for Green, Stroke' })).toBeTruthy();
    const hex = screen.getByLabelText('Hex');
    fireEvent.change(hex, { target: { value: 'F50' } });
    fireEvent.keyDown(hex, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledWith('#ff5500');
  });

  it('is the one custom colour editor: it refuses a colour it cannot read, and Use saves and closes', () => {
    const { onSave, onClose } = setup(false);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Saturation and brightness');
    const hex = screen.getByLabelText('Hex');
    fireEvent.change(hex, { target: { value: 'orange' } });
    fireEvent.keyDown(hex, { key: 'Enter' });
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(hex, { target: { value: '#123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use' }));
    expect(onSave).toHaveBeenCalledWith('#123456');
    expect(onClose).toHaveBeenCalled();
  });

  it('offers Clear override only for an overridden swatch', () => {
    setup(false);
    expect(screen.queryByRole('button', { name: 'Clear override' })).toBeNull();
    expect(screen.getByText('Theme colour: Green')).toBeTruthy();
  });

  it('clears the override, and Escape closes it with focus back on the swatch', () => {
    const { anchor, onClear, onClose } = setup(true);
    fireEvent.click(screen.getByRole('button', { name: 'Clear override' }));
    expect(onClear).toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    expect(document.activeElement).toBe(anchor);
  });
});

describe('QuickStylePanel under Minimal chrome (docs/specs/007-editor/power-user-mode.md)', () => {
  const quickStyle = {
    view: {
      targetIds: ['a'],
      sections: {
        width: { value: 'medium' as const },
        style: { value: 'solid' as const, options: ['solid', 'dashed', 'dotted'] as const },
      },
    },
    setStroke: vi.fn(),
    setBackground: vi.fn(),
    setWidth: vi.fn(),
    setStrokeStyle: vi.fn(),
    setTextAlign: vi.fn(),
    setIconAlign: vi.fn(),
    setCorners: vi.fn(),
    setTextColour: vi.fn(),
    setPenColour: vi.fn(),
    setPenWidth: vi.fn(),
    setHighlighterColour: vi.fn(),
    setHighlighterWidth: vi.fn(),
    setBoardStroke: vi.fn(),
    setBoardTextColour: vi.fn(),
    clearStyles: vi.fn(),
    setSwatchOverride: vi.fn(),
    clearSwatchOverride: vi.fn(),
    setColour: vi.fn(),
  };
  const renderPanel = (minimal: boolean) =>
    render(
      <MinimalChromeProvider value={minimal}>
        <QuickStylePanel quickStyle={quickStyle} hidden={false} />
      </MinimalChromeProvider>,
    );

  it('keeps its section titles', () => {
    renderPanel(true);
    expect(screen.getByText('Stroke width')).toBeTruthy();
    expect(screen.getByText('Stroke style')).toBeTruthy();
    expect(screen.getByText('Actions')).toBeTruthy();
  });

  it('has no header, and keeps its name', () => {
    renderPanel(false);
    expect(screen.queryByLabelText('Learn about the quick style panel')).toBeNull();
    expect(screen.getByLabelText('Quick style')).toBeTruthy();
  });
});

const PALETTE = { board: 'light' as const, ink: '#1c1917', custom: [] };

describe('QuickStylePanel on a whiteboard: the marker rows', () => {
  const api = (pen: QuickStyleView['pen'], targetIds: string[] = []) => ({
    view: { targetIds, sections: {}, pen },
    setStroke: vi.fn(),
    setBackground: vi.fn(),
    setWidth: vi.fn(),
    setStrokeStyle: vi.fn(),
    setTextAlign: vi.fn(),
    setIconAlign: vi.fn(),
    setCorners: vi.fn(),
    setTextColour: vi.fn(),
    setPenColour: vi.fn(),
    setPenWidth: vi.fn(),
    setHighlighterColour: vi.fn(),
    setHighlighterWidth: vi.fn(),
    setBoardStroke: vi.fn(),
    setBoardTextColour: vi.fn(),
    clearStyles: vi.fn(),
    setSwatchOverride: vi.fn(),
    clearSwatchOverride: vi.fn(),
    setColour: vi.fn(),
  });
  const second = heldPenStyle(DEFAULT_WHITEBOARD_PREFS.pens[1]!, PALETTE);

  it('styles the pen in hand, with nothing selected, and offers no Clear styles', () => {
    const quickStyle = api(second);
    render(<QuickStylePanel quickStyle={quickStyle} hidden={false} />);
    expect(screen.getByText('Marker 2')).toBeTruthy();
    const colour = screen.getByRole('group', { name: 'Marker colour' });
    expect(within(colour).getByRole('button', { name: 'Blue' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(within(colour).getByRole('button', { name: 'Red' }));
    expect(quickStyle.setPenColour).toHaveBeenCalledWith('red');
    const width = screen.getByRole('radiogroup', { name: 'Marker width' });
    fireEvent.click(within(width).getByRole('radio', { name: 'Bold' }));
    expect(quickStyle.setPenWidth).toHaveBeenCalledWith('bold');
    expect(screen.queryByTestId('quick-style-clear')).toBeNull();
  });

  it('offers the whiteboard’s colours on Stroke and Text colour, with the tab’s custom colours', () => {
    // docs/specs/023-draw-mode/draw-mode.md "The quick style panel stays".
    const palette = { ...PALETTE, custom: ['#868e96'] };
    const board = {
      value: 'blue' as const,
      options: stockOptions(palette),
      custom: customOptions(palette),
    };
    const quickStyle = {
      ...api(undefined, ['s1']),
      view: {
        targetIds: ['s1'],
        sections: { boardStroke: board, boardText: { ...board, value: null } },
      },
    };
    render(<QuickStylePanel quickStyle={quickStyle} hidden={false} />);
    const stroke = screen.getByRole('group', { name: 'Stroke' });
    // The nine stock colours and More colours (docs/specs/004-interface-design/colour-picker.md).
    expect(within(stroke).getAllByRole('button')).toHaveLength(10);
    expect(within(stroke).getByRole('button', { name: 'Blue' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(within(stroke).getByRole('button', { name: 'Teal' }));
    expect(quickStyle.setBoardStroke).toHaveBeenCalledWith('teal');
    const custom = screen.getByRole('group', { name: 'Custom text colours' });
    fireEvent.click(within(custom).getByRole('button', { name: '#868e96' }));
    expect(quickStyle.setBoardTextColour).toHaveBeenCalledWith('#868e96');
    expect(screen.getByRole('group', { name: 'Custom stroke colours' })).toBeTruthy();
  });

  it('offers Corners as four quick choices, marking the shared one', () => {
    // docs/specs/008-canvas/quick-style-panel.md "Corners".
    const quickStyle = {
      ...api(undefined, ['q1']),
      view: { targetIds: ['q1'], sections: { corners: { value: 'md' as const } } },
    };
    render(<QuickStylePanel quickStyle={quickStyle} hidden={false} />);
    const row = screen.getByRole('radiogroup', { name: 'Corners' });
    expect(
      within(row)
        .getAllByRole('radio')
        .map((r) => r.getAttribute('aria-label')),
    ).toEqual(['None', 'Small', 'Medium', 'Large']);
    expect(within(row).getByRole('radio', { name: 'Medium' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.click(within(row).getByRole('radio', { name: 'Large' }));
    expect(quickStyle.setCorners).toHaveBeenCalledWith('lg');
  });

  it('drops the pen name in power user mode', () => {
    render(<QuickStylePanel quickStyle={api(second)} hidden={false} powerUser />);
    expect(screen.queryByText('Marker 2')).toBeNull();
    expect(screen.getByRole('radiogroup', { name: 'Marker width' })).toBeTruthy();
  });

  it('offers the nine stock colours and More colours, and Custom colours only when the tab uses some', () => {
    // docs/specs/023-draw-mode/draw-mode.md "The quick style panel stays": quick choices only.
    const { unmount } = render(<QuickStylePanel quickStyle={api(second)} hidden={false} />);
    const colour = screen.getByRole('group', { name: 'Marker colour' });
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
    expect(screen.queryByRole('group', { name: 'Custom colours' })).toBeNull();
    unmount();
    const withCustom = heldPenStyle(DEFAULT_WHITEBOARD_PREFS.pens[1]!, {
      ...PALETTE,
      custom: ['#ff6b00', '#00a39b'],
    });
    const quickStyle = api(withCustom);
    render(<QuickStylePanel quickStyle={quickStyle} hidden={false} />);
    const custom = screen.getByRole('group', { name: 'Custom colours' });
    expect(
      within(custom)
        .getAllByRole('button')
        .map((r) => r.getAttribute('aria-label')),
    ).toEqual(['#ff6b00', '#00a39b']);
    fireEvent.click(within(custom).getByRole('button', { name: '#00a39b' }));
    expect(quickStyle.setPenColour).toHaveBeenCalledWith('#00a39b');
  });

  it('gives Marker 1 its one colour, the ink', () => {
    render(
      <QuickStylePanel
        quickStyle={api(heldPenStyle(DEFAULT_WHITEBOARD_PREFS.pens[0]!, PALETTE))}
        hidden={false}
      />,
    );
    expect(
      within(screen.getByRole('group', { name: 'Marker colour' })).getAllByRole('button'),
    ).toHaveLength(1);
  });

  it('keeps one width for every pen, whatever its colour row holds', () => {
    const widthOf = (i: number) => {
      const { unmount } = render(
        <QuickStylePanel
          quickStyle={api(heldPenStyle(DEFAULT_WHITEBOARD_PREFS.pens[i]!, PALETTE))}
          hidden={false}
        />,
      );
      const width = screen.getByTestId('quick-style-panel').style.width;
      unmount();
      return width;
    };
    expect(widthOf(0)).toBe('258px');
    expect(widthOf(1)).toBe('258px');
  });

  it('keeps Marker width at the same height for every pen', () => {
    const rowsBefore = (i: number) => {
      const { container, unmount } = render(
        <QuickStylePanel
          quickStyle={api(heldPenStyle(DEFAULT_WHITEBOARD_PREFS.pens[i]!, PALETTE))}
          hidden={false}
        />,
      );
      const width = container.querySelector('[data-testid="quick-style-marker-width"]')!;
      const body = container.querySelector('[data-quick-style-body]')!;
      const index = [...body.children].findIndex((el) => el.contains(width));
      unmount();
      return index;
    };
    expect(new Set([0, 1, 2].map(rowsBefore)).size).toBe(1);
  });
});

// docs/specs/008-canvas/quick-style-panel.md "Where it sits": a swatch row never wraps and is never
// clipped, so the width counts the targets, their gaps, the padding and the border exactly.
describe('panelFrame', () => {
  it('is one width in every mode: ten touching targets', () => {
    // Ten touching 24 px targets (the stock colours, Ink and eight, then More colours, the widest
    // row; the theme's seven, Ink and More colours leave the last empty), 8 px padding and a 1 px
    // border each side, so switching mode never resizes the panel.
    expect(QUICK_ROW_TARGETS).toBe(10);
    expect(panelFrame().width).toBe(10 * 24 + 2 * 8 + 2 * 1);
  });

  it('pads the compact panel by the padding the width counts', () => {
    expect(panelFrame().padding).toBe(8);
  });
});

// docs/specs/007-editor/editor-modes.md "One look": Ink is the eighth swatch of the Stroke and Text
// colour rows in Diagram mode, after the theme's colours.
describe('QuickStylePanel: the Ink swatch', () => {
  const swatches = Array.from({ length: 7 }, (_, slot) => ({
    slot: slot as 0,
    name: slot === 0 ? 'Theme default' : `Colour ${slot}`,
    color: '#0ea5e9',
  }));
  const api = () => ({
    view: {
      targetIds: ['a'],
      sections: {
        stroke: { value: 'ink' as const, swatches, ink: '#1c1917' },
        background: { value: 0 as const, swatches },
        textColour: { value: null, swatches, ink: '#1c1917' },
      },
    },
    setStroke: vi.fn(),
    setBackground: vi.fn(),
    setWidth: vi.fn(),
    setStrokeStyle: vi.fn(),
    setTextAlign: vi.fn(),
    setIconAlign: vi.fn(),
    setCorners: vi.fn(),
    setTextColour: vi.fn(),
    setPenColour: vi.fn(),
    setPenWidth: vi.fn(),
    setHighlighterColour: vi.fn(),
    setHighlighterWidth: vi.fn(),
    setBoardStroke: vi.fn(),
    setBoardTextColour: vi.fn(),
    clearStyles: vi.fn(),
    setSwatchOverride: vi.fn(),
    clearSwatchOverride: vi.fn(),
    setColour: vi.fn(),
  });

  it('ends the Stroke and Text colour rows with Ink, never Background, then More colours', () => {
    render(<QuickStylePanel quickStyle={api()} hidden={false} />);
    const stroke = within(screen.getByRole('group', { name: 'Stroke' })).getAllByRole('button');
    expect(stroke).toHaveLength(9);
    expect(stroke[7]!.getAttribute('aria-label')).toBe('Ink');
    expect(stroke[7]!.getAttribute('aria-pressed')).toBe('true');
    expect(stroke[8]!.getAttribute('aria-label')).toBe('More colours, stroke');
    const text = within(screen.getByRole('group', { name: 'Text colour' })).getAllByRole('button');
    expect(text[7]!.getAttribute('aria-label')).toBe('Ink');
    const fill = within(screen.getByRole('group', { name: 'Background' })).getAllByRole('button');
    expect(fill).toHaveLength(8);
  });

  // docs/specs/004-interface-design/colour-picker.md "Keyboard" and "Skins".
  it('moves focus along a colour row without choosing, and More colours opens the full picker', () => {
    const quickStyle = api();
    render(<QuickStylePanel quickStyle={quickStyle} hidden={false} />);
    const stroke = within(screen.getByRole('group', { name: 'Stroke' })).getAllByRole('button');
    stroke[7]!.focus();
    fireEvent.keyDown(stroke[7]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(stroke[8]);
    fireEvent.keyDown(stroke[8]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(stroke[0]);
    expect(quickStyle.setStroke).not.toHaveBeenCalled();
    fireEvent.click(stroke[8]!);
    const picker = screen.getByRole('dialog', { name: 'More colours, stroke' });
    fireEvent.click(within(picker).getByRole('button', { name: 'Teal' }));
    expect(quickStyle.setColour).toHaveBeenCalledWith('stroke', 'teal');
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Background' })).getAllByRole('button')[7]!,
    );
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Teal' }));
    expect(quickStyle.setColour).toHaveBeenLastCalledWith(
      'fill',
      expect.stringMatching(/^#[0-9a-f]{6}$/),
    );
  });

  it('chooses Ink by name', () => {
    const quickStyle = api();
    render(<QuickStylePanel quickStyle={quickStyle} hidden={false} />);
    const text = within(screen.getByRole('group', { name: 'Text colour' })).getAllByRole('button');
    fireEvent.click(text[7]!);
    expect(quickStyle.setTextColour).toHaveBeenCalledWith('ink');
  });

  it('opens no custom-colour popover on Ink', () => {
    render(<QuickStylePanel quickStyle={api()} hidden={false} />);
    const stroke = within(screen.getByRole('group', { name: 'Stroke' })).getAllByRole('button');
    fireEvent.contextMenu(stroke[7]!);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

// docs/specs/008-canvas/highlighter.md "Settings": the Highlighter rows.
describe('QuickStylePanel: the Highlighter rows', () => {
  const api = (highlighter: QuickStyleView['highlighter']) => ({
    view: { targetIds: [], sections: {}, highlighter },
    setStroke: vi.fn(),
    setBackground: vi.fn(),
    setWidth: vi.fn(),
    setStrokeStyle: vi.fn(),
    setTextAlign: vi.fn(),
    setIconAlign: vi.fn(),
    setCorners: vi.fn(),
    setTextColour: vi.fn(),
    setPenColour: vi.fn(),
    setPenWidth: vi.fn(),
    setHighlighterColour: vi.fn(),
    setHighlighterWidth: vi.fn(),
    setBoardStroke: vi.fn(),
    setBoardTextColour: vi.fn(),
    clearStyles: vi.fn(),
    setSwatchOverride: vi.fn(),
    clearSwatchOverride: vi.fn(),
    setColour: vi.fn(),
  });

  it('sets the armed Highlighter\u2019s next stroke, captioned with its name', () => {
    const quickStyle = api(toolHighlighterStyle('#fde047', 14));
    render(<QuickStylePanel quickStyle={quickStyle} hidden={false} />);
    expect(screen.getByText('Highlighter')).toBeTruthy();
    const colour = screen.getByRole('group', { name: 'Highlighter colour' });
    expect(
      within(colour).getByRole('button', { name: 'Yellow' }).getAttribute('aria-pressed'),
    ).toBe('true');
    fireEvent.click(within(colour).getByRole('button', { name: 'Pink' }));
    expect(quickStyle.setHighlighterColour).toHaveBeenCalledWith('#f9a8d4');
    const width = screen.getByRole('radiogroup', { name: 'Highlighter width' });
    expect(within(width).getByRole('radio', { name: 'Medium' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.click(within(width).getByRole('radio', { name: 'Bold' }));
    expect(quickStyle.setHighlighterWidth).toHaveBeenCalledWith('bold');
    expect(screen.queryByTestId('quick-style-clear')).toBeNull();
  });
});
