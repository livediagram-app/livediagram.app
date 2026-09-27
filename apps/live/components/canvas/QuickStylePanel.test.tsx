// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuickRadioRow } from './quick-style-rows';
import { SwatchOverridePopover } from './SwatchOverridePopover';

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
