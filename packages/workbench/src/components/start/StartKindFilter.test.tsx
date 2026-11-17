// @vitest-environment jsdom

// A start panel's kind filter (start-diagramming.md "Page type"): the chip names the chosen option, its menu lists
// every option as a checked radio row with its line, and choosing one hands it over and closes the menu.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lucideGlyph } from '@liveworkspace/ui';
import { lucideImage, lucideLayoutGrid } from '@liveworkspace/icons/lucide';
import { StartKindFilter, type StartKindOption } from './StartKindFilter';

afterEach(cleanup);

const OPTIONS: readonly StartKindOption<'all' | 'photo'>[] = [
  {
    id: 'all',
    name: 'All Pages',
    line: 'Every template.',
    icon: lucideGlyph(lucideLayoutGrid, 16),
  },
  { id: 'photo', name: 'Photo', line: 'A picture to edit.', icon: lucideGlyph(lucideImage, 16) },
];

function setup(value: 'all' | 'photo' = 'all') {
  const onChange = vi.fn();
  render(<StartKindFilter label="Page type" options={OPTIONS} value={value} onChange={onChange} />);
  return {
    onChange,
    chip: screen.getByRole('button', {
      name: `Page type: ${value === 'all' ? 'All Pages' : 'Photo'}`,
    }),
  };
}

describe('StartKindFilter', () => {
  it('names the chosen option on a closed menu button', () => {
    const { chip } = setup('photo');
    expect(chip.textContent).toContain('Photo');
    expect(chip.getAttribute('aria-haspopup')).toBe('menu');
    expect(chip.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens a menu of every option, its line under its name and a check on the chosen one', () => {
    const { chip } = setup();
    fireEvent.click(chip);
    expect(chip.getAttribute('aria-expanded')).toBe('true');
    const rows = screen.getAllByRole('menuitemradio');
    expect(rows.map((r) => r.getAttribute('data-kind-row'))).toEqual(['all', 'photo']);
    expect(rows.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    expect(rows[1]!.textContent).toContain('A picture to edit.');
    expect(rows[0]!.querySelectorAll('svg').length).toBe(2);
    expect(rows[1]!.querySelectorAll('svg').length).toBe(1);
  });

  it('hands over the option chosen and closes', () => {
    const { chip, onChange } = setup();
    fireEvent.click(chip);
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Photo/ }));
    expect(onChange).toHaveBeenCalledWith('photo');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes without a change when the chosen option is chosen again', () => {
    const { chip, onChange } = setup();
    fireEvent.click(chip);
    fireEvent.click(screen.getByRole('menuitemradio', { name: /All Pages/ }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens from the keyboard and closes on a press outside', () => {
    const { chip } = setup();
    fireEvent.keyDown(chip, { key: 'ArrowDown' });
    expect(screen.getByRole('menu')).toBeTruthy();
    act(() => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('falls back to the first option for a value it does not list', () => {
    const onChange = vi.fn();
    render(
      <StartKindFilter
        label="Page type"
        options={OPTIONS}
        value={'gone' as 'all'}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('button', { name: 'Page type: All Pages' })).toBeTruthy();
  });
});
