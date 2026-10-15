import type { SankeyFlowsTourApi } from '@/components/tour/sankey-flows-tour-steps';

// The open Flows dialog's tab switches, for the Sankey element tour (docs/specs/007-editor/element-tours.md "The Sankey
// tour"), which runs the dialog's Show Me steps from outside it: the dialog registers them while it is mounted. A
// module slot: one editor per page, at most one Flows dialog open.

let handle: SankeyFlowsTourApi | null = null;

export function registerSankeyFlowsDialog(next: SankeyFlowsTourApi): () => void {
  handle = next;
  return () => {
    if (handle === next) handle = null;
  };
}

/** The open dialog's tab switches; no-ops while no dialog is open. */
export const sankeyFlowsDialog: SankeyFlowsTourApi = {
  showTable: () => handle?.showTable(),
  showText: () => handle?.showText(),
};
