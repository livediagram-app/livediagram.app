// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { chartDataDialog } from '@liveworkspace/workbench/lib/chart-data-dialog-handle';
import { setActiveTour } from '@/lib/tour-active';
import { LineDataDialog } from './LineDataDialog';

afterEach(() => {
  cleanup();
  setActiveTour('element', false);
});

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

  // The Chart element tour (docs/specs/007-editor/element-tours.md "The Chart tour") runs steps inside the dialog.
  describe('under the Chart tour', () => {
    const open = () => {
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
      return { onCommit, onClose };
    };

    it('names the controls its steps ring', () => {
      open();
      for (const id of [
        'chart-data-table',
        'chart-data-series',
        'chart-data-add-row',
        'chart-data-import',
      ])
        expect(document.querySelector(`[data-tour-id="${id}"]`), id).not.toBeNull();
    });

    it('closes as Done does when the tour ends, storing what is typed', () => {
      const { onCommit, onClose } = open();
      fireEvent.change(screen.getByLabelText('Sales Jan'), { target: { value: '12' } });
      act(() => chartDataDialog.close());
      expect(onClose).toHaveBeenCalled();
      expect(onCommit).toHaveBeenCalledWith(['Jan', 'Feb'], [{ name: 'Sales', values: [12, 20] }]);
      cleanup();
      expect(() => chartDataDialog.close()).not.toThrow();
    });

    it('keeps Escape from closing it while the element tour runs', () => {
      act(() => setActiveTour('element', true));
      const { onClose } = open();
      fireEvent.keyDown(document, { key: 'Escape' });
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
