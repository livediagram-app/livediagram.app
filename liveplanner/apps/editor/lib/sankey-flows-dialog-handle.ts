import type { SankeyFlowsTourApi } from '@/components/tour/sankey-flows-tour-steps';
import { createDialogHandle } from '@liveworkspace/workbench/lib/dialog-handle';

// The open Flows dialog's tab switches and its close, for the Sankey element tour (docs/specs/007-editor/element-tours.md
// "The Sankey tour"), which runs the dialog's Show Me steps from outside it.

type SankeyFlowsDialogHandle = SankeyFlowsTourApi & {
  // Closes the dialog as its Done does, storing what is being typed first.
  close: () => void;
};

const slot = createDialogHandle<SankeyFlowsDialogHandle>();

export const registerSankeyFlowsDialog = slot.register;

/** The open dialog's tab switches and close; no-ops while no dialog is open. */
export const sankeyFlowsDialog: SankeyFlowsDialogHandle = {
  showTable: () => slot.current()?.showTable(),
  showText: () => slot.current()?.showText(),
  close: () => slot.current()?.close(),
};
