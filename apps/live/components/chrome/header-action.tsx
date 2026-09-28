import type { ReactNode } from 'react';
import { IconSlot } from '@livediagram/ui';

// The header's action pills (docs/specs/007-editor/live-app.md "Header actions"): 36px tall, fully
// rounded, an icon beside a label. Shared by EditorHeader and AuthControls so Share / Copy /
// Sign in / the account all match. They replaced full-height, edge-flush tab blocks with a 10px
// label under the icon, which read as toolbar furniture and gave Share no more weight than Sign in.
//
// `group` so a pill's glyph can react to its hover (Sign in's arrow steps towards the door).
export const HEADER_PILL =
  'optical-edges group relative inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50';

// The one primary action: a brand gradient, lighter at the top, with a brand-tinted shadow and a
// hairline inner highlight so it reads as raised. Hover lifts it a pixel; press settles it.
export const HEADER_PILL_PRIMARY =
  'bg-gradient-to-b from-brand-400 to-brand-600 text-white shadow-md shadow-brand-500/30 ring-1 ring-inset ring-white/20 hover:-translate-y-px hover:shadow-lg hover:shadow-brand-500/40 active:translate-y-0 active:shadow-sm dark:from-brand-500 dark:to-brand-700 dark:shadow-black/40';

// Everything else: white with a hairline border; hover tints border and label brand.
export const HEADER_PILL_SECONDARY =
  'border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-400 dark:hover:text-brand-200';

// Every pill's icon sits in one slot this size, so icons of different drawn sizes share a centre
// (docs/specs/004-interface-design/optical-alignment.md).
export const HEADER_ICON_SLOT_PX = 16;

// The account pill's identity disc. The 36px pill insets it 6px all round (the concentric rule).
export const HEADER_AVATAR_PX = 24;

export function HeaderGlyph({ children }: { children: ReactNode }) {
  return <IconSlot size={HEADER_ICON_SLOT_PX}>{children}</IconSlot>;
}
