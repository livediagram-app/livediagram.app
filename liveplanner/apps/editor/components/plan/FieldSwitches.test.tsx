// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FieldSwitches, NOTIFIES_LINE, REQUIRED_LINE } from './ItemTypeFieldForms';

// docs/specs/026-plan/item-types.md "Fields and Tabs": a field's on/off settings are Settings rows, a full-width card
// whose whole area flips its one switch, stacked with one gap.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
afterEach(cleanup);

describe('a field’s switches', () => {
  it('stacks a Person field’s Required and Notifies as Settings rows, each one switch with its line', () => {
    render(<FieldSwitches field={{ kind: 'person' }} onChange={vi.fn()} />);
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(2);
    const required = screen.getByRole('switch', { name: 'Required' });
    const notifies = screen.getByRole('switch', { name: 'Notifies' });
    expect(document.getElementById(required.getAttribute('aria-describedby')!)?.textContent).toBe(
      REQUIRED_LINE,
    );
    expect(document.getElementById(notifies.getAttribute('aria-describedby')!)?.textContent).toBe(
      NOTIFIES_LINE,
    );
    // Each row is its own settings cell, in one stack.
    const stack = document.querySelector('[data-field-switches]')!;
    expect(stack.querySelectorAll('[data-settings-cell]')).toHaveLength(2);
  });

  it('flips from a press anywhere on the row', () => {
    const onChange = vi.fn();
    const { rerender } = render(<FieldSwitches field={{ kind: 'text' }} onChange={onChange} />);
    const required = screen.getByRole('switch', { name: 'Required' });
    // The switch's hit area stretches over the whole cell (`after:inset-0` over the `relative` cell), so a press on
    // the row is a press on it.
    expect(required.className).toContain('after:inset-0');
    expect(required.closest('[data-settings-cell]')!.className).toContain('relative');
    fireEvent.click(required);
    expect(onChange).toHaveBeenLastCalledWith({ required: true });
    rerender(<FieldSwitches field={{ kind: 'text', required: true }} onChange={onChange} />);
    expect(screen.getByRole('switch', { name: 'Required' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Required' }));
    expect(onChange).toHaveBeenLastCalledWith({ required: undefined });
  });

  it('draws nothing for a field with no switch', () => {
    const { container } = render(<FieldSwitches field={{ kind: 'checkbox' }} onChange={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });
});
