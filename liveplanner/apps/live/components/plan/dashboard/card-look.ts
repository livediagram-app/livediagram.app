// How a Utility's style is drawn (docs/specs/026-plan/plan-tabs.md "Card style"): the slot's card takes the look's
// fill, border and shadow; what the card holds takes its inks. The cards write their text in the Dashboard's slate
// greys, so the inks are laid over those greys by class (the headings and body text the ink, the quieter lines and
// placeholders the soft ink) rather than threaded through every card: a card's own colours (a Status light, a link)
// keep theirs.
import { shadowBoxCss, type DashboardCardLook } from '@liveplanner/document';
import type { CSSProperties } from 'react';

// The inks, over the cards' slate text. Whole-class selectors, so `placeholder:text-slate-400` or
// `dark:text-slate-100` never match one by accident.
const CARD_INK_CLASSES =
  '[&_.text-slate-900]:!text-[color:var(--card-ink)] [&_.text-slate-800]:!text-[color:var(--card-ink)] [&_.text-slate-700]:!text-[color:var(--card-ink)] [&_.text-slate-600]:!text-[color:var(--card-ink-soft)] [&_.text-slate-500]:!text-[color:var(--card-ink-soft)] [&_.text-slate-400]:!text-[color:var(--card-ink-soft)] [&_::placeholder]:!text-[color:var(--card-ink-soft)]';

// The card's own surface: its fill, border and shadow over the slot card's (DashboardSlotView SLOT_CARD).
export function cardFrameStyle(look: DashboardCardLook): CSSProperties | undefined {
  const style: CSSProperties = {
    ...(look.fill ? { backgroundColor: look.fill } : {}),
    ...(look.stroke ? { borderColor: look.stroke } : {}),
    ...(look.borderWidth !== undefined ? { borderWidth: look.borderWidth } : {}),
    ...(look.borderStyle ? { borderStyle: look.borderStyle } : {}),
    ...(look.shadow
      ? { boxShadow: look.shadow === 'none' ? 'none' : shadowBoxCss(look.shadow) }
      : {}),
  };
  return Object.keys(style).length > 0 ? style : undefined;
}

// What the card holds: its fill's appearance (`light` or `dark`, an island of it whatever the page's: theme.css) and
// the inks over its slate text.
export function cardInkClass(look: DashboardCardLook): string {
  return ['contents', look.surface ?? '', look.ink ? CARD_INK_CLASSES : '']
    .filter(Boolean)
    .join(' ');
}

// What the card holds: the inks as custom properties, read by CARD_INK_CLASSES.
export function cardInkStyle(look: DashboardCardLook): CSSProperties | undefined {
  if (!look.ink) return undefined;
  return {
    '--card-ink': look.ink,
    '--card-ink-soft': look.inkSoft ?? look.ink,
  } as CSSProperties;
}
