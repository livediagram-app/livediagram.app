'use client';

import { createContext, useContext } from 'react';

// How a control inside a dialog closes it (docs/specs/007-editor/editor-app.md "Menus are bottom sheets on a phone"):
// a phone sheet slides out first and runs the control's own handler once it is gone; anywhere else (a desktop card, no
// dialog) the handler runs at once. The close (DialogCloseButton) and a sheet's Done close through it, so every way
// out of a sheet leaves it the same way.
export type DialogDismiss = (then: () => void) => void;

export const DialogDismissContext = createContext<DialogDismiss | null>(null);

const AT_ONCE: DialogDismiss = (then) => then();

export function useDialogDismiss(): DialogDismiss {
  return useContext(DialogDismissContext) ?? AT_ONCE;
}
