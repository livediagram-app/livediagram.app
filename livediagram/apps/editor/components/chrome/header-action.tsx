import type { ReactNode } from 'react';
import { IconSlot } from '@livediagram/ui';

// Full-height, edge-flush header action button: the icon stacked over a small
// label, a left divider, hugging the top + bottom of the bar so the right-edge
// actions read as a row of tabs filling the header rather than little floating
// pills. Shared by EditorHeader and AuthControls so Share / Copy / Sign in / the
// account all match. The caller adds the tone (default slate, or the Share brand fill).
export const HEADER_ACTION_BTN =
  'flex h-full min-w-[3.75rem] cursor-pointer flex-col items-center justify-center gap-1 border-l border-slate-200 px-3 text-[10px] font-medium leading-none transition dark:border-slate-800';

// The slate tone of the header actions other than Share: Sign in, the account, Search.
export const HEADER_ACTION_TONE =
  'text-slate-600 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800';

// Every header action's glyph sits in one slot this size, so the actions form one stack row: labels
// share a baseline whether the glyph is a 13px icon or the 20px account disc
// (docs/specs/004-interface-design/optical-alignment.md).
export const HEADER_ICON_SLOT_PX = 20;

export function HeaderGlyph({ children }: { children: ReactNode }) {
  return <IconSlot size={HEADER_ICON_SLOT_PX}>{children}</IconSlot>;
}
