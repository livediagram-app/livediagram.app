// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ChartAxisRows } from './ChartAxisRows';

// docs/specs/009-elements/pie-chart.md "Show Axis", "A second axis".
afterEach(cleanup);

describe('ChartAxisRows', () => {
  it('toggles the axis, and offers None or a series for the right axis on a line chart', () => {
    const onSetAxis = vi.fn();
    const onSetRightAxis = vi.fn();
    render(
      <ChartAxisRows
        axis={false}
        series={[
          { name: 'Signups', values: [1] },
          { name: 'Paid conversions', values: [2], axis: 'right' },
        ]}
        palette={['#111111']}
        onSetAxis={onSetAxis}
        onSetRightAxis={onSetRightAxis}
      />,
    );
    fireEvent.click(screen.getByText('Show Axis'));
    expect(onSetAxis).toHaveBeenCalledWith(true);
    expect(screen.getByText('Right Axis')).toBeTruthy();
    fireEvent.click(screen.getByText('Signups'));
    expect(onSetRightAxis).toHaveBeenCalledWith(0);
    // A long name is cut to the tile.
    expect(screen.getByText('Paid conv…')).toBeTruthy();
    fireEvent.click(screen.getByText('None'));
    expect(onSetRightAxis).toHaveBeenCalledWith(null);
  });

  it('offers no right axis to a column chart or a one-series line', () => {
    render(
      <ChartAxisRows
        axis
        series={null}
        palette={['#111111']}
        onSetAxis={() => {}}
        onSetRightAxis={() => {}}
      />,
    );
    expect(screen.queryByText('Right Axis')).toBeNull();
    cleanup();
    render(
      <ChartAxisRows
        axis
        series={[{ name: '', values: [1] }]}
        palette={['#111111']}
        onSetAxis={() => {}}
        onSetRightAxis={() => {}}
      />,
    );
    expect(screen.queryByText('Right Axis')).toBeNull();
  });
});
