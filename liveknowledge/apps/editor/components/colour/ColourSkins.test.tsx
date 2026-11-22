// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColourSwatchButton } from './ColourSwatchButton';
import { noColour, standardGroup } from './colour-options';

// docs/specs/004-interface-design/colour-picker.md "Skins".
const picker = {
  label: 'Colour',
  standard: [standardGroup('strong', 'light', 'hex')],
  leading: [noColour('none', 'None')],
};

describe('ColourSwatchButton', () => {
  it('toggles the popover, reports open state, and a pick closes it', () => {
    const onPick = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ColourSwatchButton
        {...picker}
        value={null}
        swatch="#000"
        onPick={onPick}
        onOpenChange={onOpenChange}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Colour' });
    fireEvent.click(trigger);
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Blue' }));
    expect(onPick).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps focus off the trigger on press when preserving a selection', () => {
    render(
      <ColourSwatchButton {...picker} value={null} swatch="#000" preserveFocus onPick={vi.fn()}>
        <b>A</b>
      </ColourSwatchButton>,
    );
    const trigger = screen.getByRole('button', { name: 'Colour' });
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    trigger.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    expect(trigger.textContent).toBe('A');
  });
});
