// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PageColourFill } from '@liveplanner/project';
import { BackgroundKinds, kindPreview } from './page-background-kinds';

// docs/specs/030-forms/forms.md "The form card, top to bottom", Cover: the kinds are tiles, each picturing what it
// makes.
afterEach(cleanup);

const gradient: PageColourFill = { kind: 'gradient', from: '#112233', to: '#445566', angle: 90 };
const solid: PageColourFill = { kind: 'solid', color: '#abcdef' };

describe('BackgroundKinds', () => {
  it('names every offered kind as a radio, the one on show checked, and a press chooses', () => {
    const onChange = vi.fn();
    render(
      <BackgroundKinds
        categories={['solid', 'gradient', 'animated']}
        value="gradient"
        current="solid"
        fill={solid}
        accent="#2563eb"
        themeGradient={gradient}
        onChange={onChange}
      />,
    );
    const group = screen.getByRole('radiogroup', { name: 'Background kind' });
    const radios = screen.getAllByRole('radio');
    expect(group).toBeTruthy();
    expect(radios.map((r) => r.textContent)).toEqual(['Solid', 'Gradient', 'Animated']);
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    fireEvent.click(screen.getByRole('radio', { name: 'Animated' }));
    expect(onChange).toHaveBeenCalledWith('animated');
  });

  it('lays the kinds across the whole row', () => {
    render(
      <BackgroundKinds
        categories={['solid', 'gradient']}
        value="solid"
        current="solid"
        fill={undefined}
        accent="#2563eb"
        themeGradient={undefined}
        onChange={() => {}}
      />,
    );
    expect(
      screen.getByRole('radiogroup', { name: 'Background kind' }).style.gridTemplateColumns,
    ).toBe('repeat(2, minmax(0, 1fr))');
  });
});

describe('kindPreview', () => {
  it('pictures the cover’s own fill on its kind’s tile', () => {
    expect(kindPreview('solid', solid, 'solid', '#2563eb', gradient)).toBe('#abcdef');
    expect(kindPreview('solid', undefined, 'solid', '#2563eb', gradient)).toBe('#ffffff');
    expect(kindPreview('gradient', gradient, 'gradient', '#2563eb', undefined)).toBe(
      'linear-gradient(90deg, #112233, #445566)',
    );
  });

  it('falls back to the theme on the other tiles', () => {
    expect(kindPreview('solid', gradient, 'gradient', '#2563eb', gradient)).toBe('#2563eb33');
    expect(kindPreview('gradient', solid, 'solid', '#2563eb', gradient)).toBe(
      'linear-gradient(90deg, #112233, #445566)',
    );
    expect(kindPreview('animated', undefined, 'solid', '#2563eb', undefined)).toBe(
      'linear-gradient(135deg, #2563eb55, #2563eb)',
    );
  });
});
