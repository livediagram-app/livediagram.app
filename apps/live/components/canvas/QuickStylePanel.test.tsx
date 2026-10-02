// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { QuickStyleView } from '@/lib/quick-style';
import { customOptions, heldPenStyle, stockOptions } from '@/lib/quick-style-pen';
import { DEFAULT_WHITEBOARD_PREFS } from '@/lib/whiteboard-prefs';
import { describe, expect, it, vi } from 'vitest';
import { QuickRadioRow } from './quick-style-rows';
import { SwatchOverridePopover } from './SwatchOverridePopover';
import { QuickStylePanel, panelFrame } from './QuickStylePanel';
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

describe('QuickRadioRow: custom swatches and density', () => {
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
  const renderSwatches = (density: 'compact' | 'roomy' = 'compact') => {
    const onOptionContext = vi.fn();
    render(
      <QuickRadioRow
        title="Stroke"
        showTitle
        options={swatches}
        value={null}
        onChoose={vi.fn()}
        onOptionContext={onOptionContext}
        density={density}
        testId="row"
      />,
    );
    return onOptionContext;
  };

  it('opens the swatch menu on right-click, Shift+F10 and the context-menu key', () => {
    const onOptionContext = renderSwatches();
    const custom = screen.getByRole('radio', { name: 'Custom orange, in place of Green' });
    fireEvent.contextMenu(custom);
    fireEvent.keyDown(custom, { key: 'F10', shiftKey: true });
    fireEvent.keyDown(custom, { key: 'ContextMenu' });
    expect(onOptionContext).toHaveBeenCalledTimes(3);
    expect(onOptionContext).toHaveBeenLastCalledWith(4, custom);
  });

  it('marks an overridden swatch, and only that one', () => {
    renderSwatches();
    const custom = screen.getByRole('radio', { name: 'Custom orange, in place of Green' });
    expect(custom.querySelector('[data-swatch-marker]')).not.toBeNull();
    expect(
      screen.getByRole('radio', { name: 'Theme default' }).querySelector('[data-swatch-marker]'),
    ).toBeNull();
  });

  it('keeps every swatch a 24 px target, drawing a smaller chip when compact', () => {
    renderSwatches('compact');
    const button = screen.getByRole('radio', { name: 'Theme default' });
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

  it('refuses a colour it cannot read, and says how to write one', () => {
    const { onSave } = setup(false);
    const hex = screen.getByLabelText('Hex');
    fireEvent.change(hex, { target: { value: 'orange' } });
    fireEvent.keyDown(hex, { key: 'Enter' });
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a colour like #1a2b3c')).toBeTruthy();
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
    setBoardStroke: vi.fn(),
    setBoardTextColour: vi.fn(),
    clearStyles: vi.fn(),
    setSwatchOverride: vi.fn(),
    clearSwatchOverride: vi.fn(),
  };
  const renderPanel = (minimal: boolean) =>
    render(
      <MinimalChromeProvider value={minimal}>
        <QuickStylePanel quickStyle={quickStyle} hidden={false} layout="floating" />
      </MinimalChromeProvider>,
    );

  it('keeps its section titles', () => {
    renderPanel(true);
    expect(screen.getByText('Stroke width')).toBeTruthy();
    expect(screen.getByText('Stroke style')).toBeTruthy();
    expect(screen.getByText('Actions')).toBeTruthy();
  });

  it('drops the docked header, which would be empty, and keeps its name', () => {
    renderPanel(true);
    expect(screen.queryByLabelText('Learn about the quick style panel')).toBeNull();
    expect(screen.getByLabelText('Quick style')).toBeTruthy();
  });

  it('shows the header with its help link otherwise', () => {
    renderPanel(false);
    expect(screen.getByLabelText('Learn about the quick style panel')).toBeTruthy();
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
    setBoardStroke: vi.fn(),
    setBoardTextColour: vi.fn(),
    clearStyles: vi.fn(),
    setSwatchOverride: vi.fn(),
    clearSwatchOverride: vi.fn(),
  });
  const second = heldPenStyle(DEFAULT_WHITEBOARD_PREFS.pens[1]!, PALETTE);

  it('styles the pen in hand, with nothing selected, and offers no Clear styles', () => {
    const quickStyle = api(second);
    render(<QuickStylePanel quickStyle={quickStyle} hidden={false} layout="toolbar" />);
    expect(screen.getByText('Marker 2')).toBeTruthy();
    const colour = screen.getByRole('radiogroup', { name: 'Marker colour' });
    expect(within(colour).getByRole('radio', { name: 'Blue' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.click(within(colour).getByRole('radio', { name: 'Red' }));
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
    render(<QuickStylePanel quickStyle={quickStyle} hidden={false} layout="toolbar" />);
    const stroke = screen.getByRole('radiogroup', { name: 'Stroke' });
    expect(within(stroke).getAllByRole('radio')).toHaveLength(8);
    expect(within(stroke).getByRole('radio', { name: 'Blue' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.click(within(stroke).getByRole('radio', { name: 'Teal' }));
    expect(quickStyle.setBoardStroke).toHaveBeenCalledWith('teal');
    const custom = screen.getByRole('radiogroup', { name: 'Custom text colours' });
    fireEvent.click(within(custom).getByRole('radio', { name: 'Custom #868e96' }));
    expect(quickStyle.setBoardTextColour).toHaveBeenCalledWith('#868e96');
    expect(screen.getByRole('radiogroup', { name: 'Custom stroke colours' })).toBeTruthy();
  });

  it('offers Corners as four quick choices, marking the shared one', () => {
    // docs/specs/008-canvas/quick-style-panel.md "Corners".
    const quickStyle = {
      ...api(undefined, ['q1']),
      view: { targetIds: ['q1'], sections: { corners: { value: 'md' as const } } },
    };
    render(<QuickStylePanel quickStyle={quickStyle} hidden={false} layout="toolbar" />);
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
    render(<QuickStylePanel quickStyle={api(second)} hidden={false} layout="toolbar" powerUser />);
    expect(screen.queryByText('Marker 2')).toBeNull();
    expect(screen.getByRole('radiogroup', { name: 'Marker width' })).toBeTruthy();
  });

  it('offers the eight stock colours, and Custom colours only when the tab uses some', () => {
    // docs/specs/023-draw-mode/draw-mode.md "The quick style panel stays": quick choices only.
    const { unmount } = render(
      <QuickStylePanel quickStyle={api(second)} hidden={false} layout="toolbar" />,
    );
    const colour = screen.getByRole('radiogroup', { name: 'Marker colour' });
    expect(
      within(colour)
        .getAllByRole('radio')
        .map((r) => r.getAttribute('aria-label')),
    ).toEqual(['Ink', 'Blue', 'Red', 'Orange', 'Green', 'Teal', 'Violet', 'Pink']);
    expect(screen.queryByRole('radiogroup', { name: 'Custom colours' })).toBeNull();
    expect(screen.queryByRole('button', { name: /more colours/i })).toBeNull();
    unmount();
    const withCustom = heldPenStyle(DEFAULT_WHITEBOARD_PREFS.pens[1]!, {
      ...PALETTE,
      custom: ['#ff6b00', '#00a39b'],
    });
    const quickStyle = api(withCustom);
    render(<QuickStylePanel quickStyle={quickStyle} hidden={false} layout="toolbar" />);
    const custom = screen.getByRole('radiogroup', { name: 'Custom colours' });
    expect(
      within(custom)
        .getAllByRole('radio')
        .map((r) => r.getAttribute('aria-label')),
    ).toEqual(['Custom #ff6b00', 'Custom #00a39b']);
    fireEvent.click(within(custom).getByRole('radio', { name: 'Custom #00a39b' }));
    expect(quickStyle.setPenColour).toHaveBeenCalledWith('#00a39b');
  });

  it('gives Marker 1 its one colour, the ink', () => {
    render(
      <QuickStylePanel
        quickStyle={api(heldPenStyle(DEFAULT_WHITEBOARD_PREFS.pens[0]!, PALETTE))}
        hidden={false}
        layout="toolbar"
      />,
    );
    expect(
      within(screen.getByRole('radiogroup', { name: 'Marker colour' })).getAllByRole('radio'),
    ).toHaveLength(1);
  });

  it('keeps one width for every pen, whatever its colour row holds', () => {
    const widthOf = (i: number) => {
      const { unmount } = render(
        <QuickStylePanel
          quickStyle={api(heldPenStyle(DEFAULT_WHITEBOARD_PREFS.pens[i]!, PALETTE))}
          hidden={false}
          layout="toolbar"
        />,
      );
      const width = screen.getByTestId('quick-style-panel').style.width;
      unmount();
      return width;
    };
    expect(widthOf(0)).toBe('210px');
    expect(widthOf(1)).toBe('210px');
  });

  it('keeps Marker width at the same height for every pen', () => {
    const rowsBefore = (i: number) => {
      const { container, unmount } = render(
        <QuickStylePanel
          quickStyle={api(heldPenStyle(DEFAULT_WHITEBOARD_PREFS.pens[i]!, PALETTE))}
          hidden={false}
          layout="toolbar"
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
  it('is fixed in every form: compact, pen rows, Floating with or without a Palette', () => {
    // Seven touching 24 px targets, 8 px padding and a 1 px border each side.
    expect(panelFrame(false, false, false).width).toBe(7 * 24 + 2 * 8 + 2 * 1);
    // Eight for a whiteboard's pen rows: the ink and seven colours, or the opener.
    expect(panelFrame(false, false, true).width).toBe(8 * 24 + 2 * 8 + 2 * 1);
    // Floating spreads eight with 4 px gaps inside 10 px padding.
    expect(panelFrame(true, false, true).width).toBe(8 * 24 + 7 * 4 + 2 * 10 + 2 * 1);
    // With a Palette on screen the Palette's width is the panel's.
    expect(panelFrame(true, true, true).width).toBeUndefined();
  });

  it('pads the compact panel by the padding the width counts', () => {
    expect(panelFrame(false, false, true).padding).toBe(8);
    expect(panelFrame(true, false, true).padding).toBeUndefined();
  });
});
