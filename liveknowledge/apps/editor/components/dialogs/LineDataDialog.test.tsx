// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LineDataDialog } from './LineDataDialog';

afterEach(cleanup);

const series = [{ name: 'Sales', values: [10, 20] }];

describe('LineDataDialog', () => {
  it('names each row and series control after its position, so no two share a name', () => {
    render(
      <LineDataDialog
        categories={['Jan', 'Feb']}
        series={[...series, { name: 'Costs', values: [5, 6] }]}
        onCommit={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Series 2 name')).toHaveProperty('value', 'Costs');
    expect(screen.getByLabelText('Category 1')).toHaveProperty('value', 'Jan');
    expect(screen.getByRole('button', { name: 'Remove series 2' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove row 2' })).toBeTruthy();
  });

  it('commits a typed value when Escape closes the dialog mid-edit', () => {
    const onCommit = vi.fn();
    const onClose = vi.fn();
    render(
      <LineDataDialog
        categories={['Jan', 'Feb']}
        series={series}
        onCommit={onCommit}
        onClose={onClose}
      />,
    );
    fireEvent.change(screen.getByLabelText('Sales Feb'), { target: { value: '25' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(['Jan', 'Feb'], [{ name: 'Sales', values: [10, 25] }]);
  });

  it('commits nothing for a blur or a close with no change', () => {
    const onCommit = vi.fn();
    render(
      <LineDataDialog
        categories={['Jan', 'Feb']}
        series={series}
        onCommit={onCommit}
        onClose={vi.fn()}
      />,
    );
    fireEvent.blur(screen.getByLabelText('Sales Feb'));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits a blurred edit once, not again on close', () => {
    const onCommit = vi.fn();
    render(
      <LineDataDialog
        categories={['Jan', 'Feb']}
        series={series}
        onCommit={onCommit}
        onClose={vi.fn()}
      />,
    );
    const cell = screen.getByLabelText('Sales Jan');
    fireEvent.change(cell, { target: { value: '12' } });
    fireEvent.blur(cell);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});
