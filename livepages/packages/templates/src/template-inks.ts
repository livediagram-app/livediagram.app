// Inks a template writes so its words read for every viewer of the Default scheme, in either half
// (docs/specs/011-theme/light-and-dark.md "What a viewer sees"). A label with no colour of its own takes the
// viewer's ink: dark on the light canvas, light on the dark one. That is right on the canvas and wrong on a panel
// whose fill the template fixes, which stays pale in both halves. apps/live/lib/template-overlay-contrast.test.ts
// holds every template's labels to what is drawn behind them.

/** Words on a panel whose fill the template fixes (a pale card, a pastel lane): the panel is the same in both
 *  halves, so one dark ink reads on it. */
export const PAPER_INK = '#0f172a';

/** Coloured words drawn straight on the canvas. Each tone reads at 3:1 or more on both the light (#fbfaf7) and the
 *  dark (#0d121a) canvas; the deep shades picked for paper (#991b1b, #334155) sank into the dark one. */
export const CANVAS_TONES = {
  slate: '#64748b',
  red: '#dc2626',
  indigo: '#6366f1',
  amber: '#b45309',
  blue: '#2563eb',
  sky: '#0284c7',
} as const;
