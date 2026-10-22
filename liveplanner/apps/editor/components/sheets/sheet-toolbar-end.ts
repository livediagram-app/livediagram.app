'use client';

// What a Sheet's toolbar ends with in a header band (docs/specs/029-sheets/sheet.md "Toolbar"): the header's own
// controls (Focus, Maximise or Restore, the cog, a slot's menu), handed in by SheetHeader so the top row's right is one
// card, the cog after Search. Null everywhere else: on the canvas the controls keep their place in the header.
import { createContext, useContext, type ReactNode } from 'react';

export const SheetToolbarEnd = createContext<ReactNode>(null);

export function useSheetToolbarEnd(): ReactNode {
  return useContext(SheetToolbarEnd);
}
