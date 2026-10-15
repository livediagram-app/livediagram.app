import { createDialogHandle } from './dialog-handle';

// The open Chart data dialog's close, for the Chart element tour (docs/specs/007-editor/element-tours.md "The Chart
// tour"), which runs steps inside the dialog from outside it and closes it on Done.

export type ChartDataDialogHandle = {
  // Closes the dialog as its Done does, storing what is being typed first.
  close: () => void;
};

const slot = createDialogHandle<ChartDataDialogHandle>();

export const registerChartDataDialog = slot.register;

/** The open dialog's close; a no-op while no dialog is open. */
export const chartDataDialog: ChartDataDialogHandle = {
  close: () => slot.current()?.close(),
};
