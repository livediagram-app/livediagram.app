// The card grid and the card shell every card-shaped surface shares:
// the Explorer's Recent / folder cards and the Timeline's event cards
// (docs/specs/006-diagram/diagram-snapshots.md, docs/specs/013-workspace/timeline.md §2). One set of classes, so a diagram looks like
// the same diagram whichever page it's on.

/** One column on a phone, two from `sm:`, three from `lg:`. */
export const CARD_GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3';

export const CARD_SHELL =
  'group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-brand-300 hover:shadow dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/50';

// Fixed height (not an aspect ratio): every diagram's SVG has a
// different intrinsic shape, so an aspect-ratio box would resolve to a
// different height per card. A fixed-height letterbox keeps every
// preview, and therefore every card, the same height; the snapshot
// sits centred via object-contain.
export const CARD_PREVIEW =
  'flex h-48 w-full items-center justify-center border-b border-slate-100 bg-slate-50/70 dark:border-slate-700/60 dark:bg-slate-900/30';
