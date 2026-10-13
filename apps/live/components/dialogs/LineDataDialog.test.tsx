// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LineDataDialog } from './LineDataDialog';

afterEach(cleanup);

const series = [{ name: 'Sales', values: [10, 20] }];

describe('LineDataDialog', () => {
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
