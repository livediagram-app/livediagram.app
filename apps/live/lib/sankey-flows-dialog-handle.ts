import type { SankeyFlowsTourApi } from '@/components/tour/sankey-flows-tour-steps';

// The open Flows dialog's tab switches and its close, for the Sankey element tour (docs/specs/007-editor/element-tours.md "The Sankey
// tour"), which runs the dialog's Show Me steps from outside it: the dialog registers them while it is mounted. A
// module slot: one editor per page, at most one Flows dialog open.

export type SankeyFlowsDialogHandle = SankeyFlowsTourApi & {
  // Closes the dialog as its Done does, storing what is being typed first.
  close: () => void;
};

let handle: SankeyFlowsDialogHandle | null = null;

export function registerSankeyFlowsDialog(next: SankeyFlowsDialogHandle): () => void {
  handle = next;
  return () => {
    if (handle === next) handle = null;
  };
}

/** The open dialog's tab switches and close; no-ops while no dialog is open. */
export const sankeyFlowsDialog: SankeyFlowsDialogHandle = {
  showTable: () => handle?.showTable(),
  showText: () => handle?.showText(),
  close: () => handle?.close(),
};
