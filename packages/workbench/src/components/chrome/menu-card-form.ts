'use client';

// The menu box's form beside a crowded strip (docs/specs/007-editor/toolbar-layout.md "The tab's name"; useMenuCardFit
// in useMenuCardRoom.ts picks it, ToolbarMenuCard hands it down):
// - `full`: the menu button and the mode switch with its name;
// - `icon`: the mode switch down to its icon alone, as a phone draws it;
// - `bare`: shorter still, where even that does not fit (the tab's name, which once hid here, left the box with
//   Work Tracker 1289).
// The menu button and the mode switch are never capped or cut. Outside a menu box, `full`.
import { createContext, useContext } from 'react';

export type MenuCardForm = 'full' | 'icon' | 'bare';

export const MenuCardFormContext = createContext<MenuCardForm>('full');

export function useMenuCardForm(): MenuCardForm {
  return useContext(MenuCardFormContext);
}
