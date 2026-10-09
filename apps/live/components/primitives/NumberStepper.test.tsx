// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NumberStepper } from './NumberStepper';

function show(value = 5, onCommit = vi.fn()) {
  render(
    <NumberStepper
      label="Width"
      value={value}
      min={2}
      max={9}
      step={2}
      unit="px"
      onCommit={onCommit}
    />,
  );
  return { onCommit, field: screen.getByLabelText('Width') as HTMLInputElement };
}

describe('the number stepper', () => {
  it('steps with its buttons and the arrow keys, kept within its bounds', () => {
    const { onCommit, field } = show();
    fireEvent.click(screen.getByRole('button', { name: 'Increase Width' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decrease Width' }));
    fireEvent.keyDown(field, { key: 'ArrowUp' });
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect(onCommit.mock.calls).toEqual([[7], [3], [7], [3]]);
    expect(screen.getByText('px')).toBeTruthy();
  });

  it('steps from a typed value with the arrow keys', () => {
    const { onCommit, field } = show();
    fireEvent.change(field, { target: { value: '6' } });
    fireEvent.keyDown(field, { key: 'ArrowUp' });
    expect(onCommit).toHaveBeenLastCalledWith(8);
  });

  it('turns its buttons off at the ends', () => {
    show(9);
    expect(
      (screen.getByRole('button', { name: 'Increase Width' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('applies typing on Enter or blur, clamped, and drops an empty or escaped draft', () => {
    const { onCommit, field } = show();
    fireEvent.change(field, { target: { value: '8x' } });
    expect(field.value).toBe('8');
    fireEvent.keyDown(field, { key: 'Enter' });
    fireEvent.change(field, { target: { value: '99' } });
    fireEvent.blur(field);
    fireEvent.change(field, { target: { value: '' } });
    fireEvent.blur(field);
    fireEvent.change(field, { target: { value: '6' } });
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(field.value).toBe('5');
    fireEvent.change(field, { target: { value: '5' } });
    fireEvent.blur(field);
    fireEvent.focus(field);
    expect(onCommit.mock.calls).toEqual([[8], [9]]);
  });
});
