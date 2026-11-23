// @vitest-environment jsdom
// The From a Plan dialog's series mapping (liveworkspace/docs/specs/004-index/live-data.md "The element"): which series
// feed the element, in what order, and the chips that pick them.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SeriesChips, seriesOrder, toggledSeries } from './SeriesChips';

afterEach(cleanup);

describe('seriesOrder and toggledSeries', () => {
  it('reads every series when none is named, skipping one past the read', () => {
    expect(seriesOrder(3, undefined)).toEqual([0, 1, 2]);
    expect(seriesOrder(3, [2, 7])).toEqual([2]);
    expect(seriesOrder(2, [5])).toEqual([0, 1]);
  });

  it('adds at the end, takes out while another stays, and names none for all in order', () => {
    expect(toggledSeries(3, undefined, 1)).toEqual([0, 2]);
    expect(toggledSeries(3, [2], 0)).toEqual([2, 0]);
    expect(toggledSeries(3, [2], 2)).toEqual([2]);
    expect(toggledSeries(2, [0], 1)).toBeUndefined();
  });
});

describe('SeriesChips', () => {
  it('numbers the series that feed it and names an unnamed one', () => {
    const onChange = vi.fn();
    render(
      <SeriesChips names={['A', '']} picked={[1, 0]} onChange={onChange} firstAlone={false} />,
    );
    expect(screen.getByRole('button', { name: /Series 2/, pressed: true }).textContent).toBe(
      '1Series 2',
    );
    fireEvent.click(screen.getByRole('button', { name: /A/ }));
    expect(onChange).toHaveBeenCalledWith([1]);
    expect(screen.getByText(/feed it, in that order/)).toBeTruthy();
  });
});
