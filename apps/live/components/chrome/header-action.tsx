import type { ReactNode } from 'react';
import { IconSlot } from '@livediagram/ui';

// The header's action buttons (docs/specs/007-editor/live-app.md "Header actions"): the same
// flat shape as the section switch at the other end of the bar (ProductNav): 34px tall,
// rounded-lg, a hairline border, 14px medium text, an icon beside the label. Shared by
// EditorHeader and AuthControls so Share / Copy / Sign in / the account all match. They
// replaced full-height tab blocks with a 10px label under the icon, and then a round,
// gradient pill style that read as dated.
//
// `group` so a button's glyph can react to its hover (Sign in's arrow steps towards the door).
export const HEADER_PILL =
  'optical-edges group relative inline-flex h-[34px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-medium outline-none transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50';

// The one primary action: flat solid brand, one step deeper on hover.
export const HEADER_PILL_PRIMARY =
  'border border-brand-600 bg-brand-500 text-white shadow-sm hover:bg-brand-600 dark:border-brand-500 dark:bg-brand-600 dark:hover:bg-brand-700';

// Everything else: exactly the section switch's look.
export const HEADER_PILL_SECONDARY =
  'border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-100';

// Every pill's icon sits in one slot this size, so icons of different drawn sizes share a centre
// (docs/specs/004-interface-design/optical-alignment.md).
export const HEADER_ICON_SLOT_PX = 16;

// The account button's identity disc. The 34px button insets it 5px all round (the concentric rule).
export const HEADER_AVATAR_PX = 24;

export function HeaderGlyph({ children }: { children: ReactNode }) {
  return <IconSlot size={HEADER_ICON_SLOT_PX}>{children}</IconSlot>;
}
