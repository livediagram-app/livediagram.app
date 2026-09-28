import type { ReactNode } from 'react';
import { IconSlot } from '@livediagram/ui';

// The header's action buttons (docs/specs/007-editor/live-app.md "Header actions"): compact
// (32px), rounded-md, 13px medium text with the icon beside it. One solid primary (Share), the
// rest borderless so the bar stays quiet. Shared by EditorHeader and AuthControls so Share /
// Copy / Sign in / the account all match. Earlier versions (full-height tab blocks, gradient
// pills, bordered boxes) read as dated or as furniture.
//
// `group` so a button's glyph can react to its hover (Sign in's arrow steps towards the door).
export const HEADER_PILL =
  'optical-edges group relative inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium outline-none transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50';

// The one primary action: near-black ink (white in dark mode), a hairline inner highlight.
export const HEADER_PILL_PRIMARY =
  'bg-slate-900 text-white shadow-sm ring-1 ring-inset ring-white/10 hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:ring-slate-900/10 dark:hover:bg-slate-200';

// Everything else: borderless text, a soft fill on hover.
export const HEADER_PILL_SECONDARY =
  'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';

// Every pill's icon sits in one slot this size, so icons of different drawn sizes share a centre
// (docs/specs/004-interface-design/optical-alignment.md).
export const HEADER_ICON_SLOT_PX = 16;

// The account button's identity disc. The 32px button insets it 4px all round (the concentric rule).
export const HEADER_AVATAR_PX = 24;

export function HeaderGlyph({ children }: { children: ReactNode }) {
  return <IconSlot size={HEADER_ICON_SLOT_PX}>{children}</IconSlot>;
}
