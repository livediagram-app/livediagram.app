// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChartTypeTiles } from './ChartTypeTiles';

describe('ChartTypeTiles (docs/specs/009-elements/pie-chart.md "Chart types")', () => {
  it('offers the seven types, the chart’s own pressed, and picks one', () => {
    const onSet = vi.fn();
    render(<ChartTypeTiles current="doughnut" onSet={onSet} />);
    const tiles = screen.getAllByRole('button');
    expect(tiles.map((t) => t.textContent)).toEqual([
      'Column',
      'Bar',
      'Line',
      'Area',
      'Scatter',
      'Pie',
      'Doughnut',
    ]);
    expect(screen.getByRole('button', { name: 'Doughnut' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: 'Pie' }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Scatter' }));
    expect(onSet).toHaveBeenCalledWith('scatter');
  });
});
