// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColourField } from './ColourField';
import { ColourSwatchButton } from './ColourSwatchButton';
import { noColour, standardGroup } from './colour-options';

// docs/specs/004-interface-design/colour-picker.md "Skins".
const picker = {
  label: 'Colour',
  standard: [standardGroup('strong', 'light', 'hex')],
  leading: [noColour('none', 'None')],
};

describe('ColourField', () => {
  it('shows the colour in force, opens the picker on the picked swatch, and a pick closes it', async () => {
    const onPick = vi.fn();
    render(
      <ColourField
        {...picker}
        value="none"
        none
        swatch="transparent"
        name="None"
        onPick={onPick}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Colour: None' });
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    await act(() => new Promise((r) => requestAnimationFrame(() => r(null))));
    expect(document.activeElement?.getAttribute('aria-label')).toBe('None');
    fireEvent.click(screen.getByRole('button', { name: 'Green' }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('opens with an arrow key and closes on Escape', () => {
    render(<ColourField {...picker} value={null} swatch="#fff" name="White" onPick={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Colour: White' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByRole('dialog', { name: 'Colour' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

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
