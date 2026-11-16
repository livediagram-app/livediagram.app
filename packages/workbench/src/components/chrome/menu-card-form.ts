'use client';

// The menu box's form beside a crowded strip (docs/specs/007-editor/toolbar-layout.md "The tab's name"; useMenuCardFit
// in useMenuCardRoom.ts picks it, ToolbarMenuCard hands it down):
// - `full`: the menu button, the mode switch with its name, and the tab's name (truncating);
// - `icon`: the mode switch down to its icon alone, as a phone draws it, so the name keeps a readable slot;
// - `bare`: the tab's name hidden too, with its hairline (it stays in the tab strip and the window title).
// The menu button and the mode switch are never capped or cut. Outside a menu box, `full`.
import { createContext, useContext } from 'react';

export type MenuCardForm = 'full' | 'icon' | 'bare';

export const MenuCardFormContext = createContext<MenuCardForm>('full');

export function useMenuCardForm(): MenuCardForm {
  return useContext(MenuCardFormContext);
}
