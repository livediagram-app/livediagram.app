// The look every floating toolbar card shares (docs/specs/007-editor/toolbar-layout.md): the Toolbar
// layout's strip, and the page toolbar of an article page, so a bar of controls reads as one
// product wherever it sits.

/** The card: white, hairline border, a soft shadow, a 4px inset around 36px controls. */
export const TOOLBAR_CARD =
  'flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-md shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40';

/** A phone strip's rail that gives way and swipes sideways (the category bar, the tile rail, an article's dock): it pads
 *  for its tiles' pressed rings (cancelled by a matching negative margin, so the strip doesn't move), contains its swipe
 *  so it never pans the page, hides its scrollbar, and fades the edge with more beyond it (`scroll-edge-fade`), so a
 *  tile cut by the edge reads as more to swipe to rather than a stray sliver. Its y axis is hidden, not auto: the
 *  tiles' 44px tap areas (touch-target-y) reach past it and made it scroll 1px. */
export const STRIP_RAIL_SCROLL =
  'scroll-edge-fade min-w-0 -my-[3px] overflow-x-auto overflow-y-hidden overscroll-x-contain py-[3px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

/** The hairline between groups of controls. */
export const TOOLBAR_DIVIDER = 'mx-0.5 h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700';

/** A control at rest. */
export const TOOLBAR_CONTROL_REST =
  'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';

/** A tinted strip button's frame (Say's and the call group's, docs/specs/008-canvas/avatar-mode.md "The avatar
 *  palette"): 36px tall (a 44px tap area), rounded, on the brand tint (`TOOLBAR_TRIGGER_TONE` at rest). */
export const STRIP_TINT_BUTTON =
  'relative flex h-9 shrink-0 touch-target-y items-center justify-center gap-1.5 rounded-md transition';

/** A tinted strip button whose popover is open: a step deeper on the same tint. */
export const STRIP_TINT_OPEN =
  'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100';

/** A strip button named beside its glyph, or the glyph alone (44px wide on a phone, for the thumb). */
export const STRIP_CONTROL_NAMED = 'pl-2 pr-2.5';
export const STRIP_CONTROL_GLYPH = 'w-9 phone:w-11';

/** A strip button's name, beside its glyph. */
export const STRIP_CONTROL_LABEL = 'text-[13px] font-medium leading-none';
