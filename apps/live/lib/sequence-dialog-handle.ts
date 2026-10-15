import { createDialogHandle } from './dialog-handle';

// The open Sequence dialog's tab switches and its close, for the Sequence element tour
// (docs/specs/007-editor/element-tours.md "The Sequence tour"), which runs steps inside the dialog from outside it.

export type SequenceDialogHandle = {
  showMessages: () => void;
  showText: () => void;
  // Closes the dialog as its Done does, storing what is being typed first.
  close: () => void;
};

const slot = createDialogHandle<SequenceDialogHandle>();

export const registerSequenceDialog = slot.register;

/** The open dialog's tab switches and close; no-ops while no dialog is open. */
export const sequenceDialog: SequenceDialogHandle = {
  showMessages: () => slot.current()?.showMessages(),
  showText: () => slot.current()?.showText(),
  close: () => slot.current()?.close(),
};
