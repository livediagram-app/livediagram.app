// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoleSwitch } from './RoleSwitch';

// The role switch a pass is chosen with (the Connect list, a project kit's setup): a named radio group, the chosen
// segment checked and the one Tab stop, the arrows walking it round.
afterEach(cleanup);

const OPTIONS = [
  { value: 'edit', label: 'Editor' },
  { value: 'participate', label: 'Participant' },
  { value: 'view', label: 'Viewer' },
] as const;

function draw(value: (typeof OPTIONS)[number]['value'], size?: 'small' | 'large') {
  const onChange = vi.fn();
  render(
    <RoleSwitch
      value={value}
      options={OPTIONS}
      onChange={onChange}
      label="Role"
      describedBy="line"
      size={size}
    />,
  );
  return { group: screen.getByRole('radiogroup', { name: 'Role' }), onChange };
}

describe('RoleSwitch', () => {
  it('checks the chosen role, the one Tab stop', () => {
    const { group } = draw('participate');
    expect(group.getAttribute('aria-describedby')).toBe('line');
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(radios.map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
    expect(radios[0]!.className).toContain('text-[12px]');
  });

  it('chooses a role pressed', () => {
    const { onChange } = draw('edit');
    fireEvent.click(screen.getByRole('radio', { name: 'Viewer' }));
    expect(onChange).toHaveBeenCalledWith('view');
  });

  it('walks with the arrows, round the ends, and Home and End', () => {
    const { group, onChange } = draw('edit', 'large');
    expect(screen.getAllByRole('radio')[0]!.className).toContain('min-h-11');
    for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End', 'Tab'])
      fireEvent.keyDown(group, { key });
    expect(onChange.mock.calls.map((c): unknown => c[0])).toEqual([
      'participate',
      'participate',
      'view',
      'view',
      'edit',
      'view',
    ]);
  });
});
