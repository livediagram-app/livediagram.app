// What an animated background's moving parts are painted with, and the fixed seeds that place them
// (docs/specs/007-editor/pages-mode.md "Animated backgrounds" in livedocuments and livedesign,
// docs/specs/030-forms/forms.md "The form card, top to bottom", Cover in liveplanner). Each product
// works its paint out of a gradient with its own colour helpers (`motionPaint`, lib/page-motion.ts).

export type MotionPaint = {
  // The two stops, for parts tinted like the page.
  a: string;
  b: string;
  // A light that reads on the page: near white on a dark page, white on a light one.
  hi: string;
  // A shade deeper than the page, for parts that sit in its shadows.
  lo: string;
  // How strongly the moving parts show: a light page takes them softer.
  strength: number;
  // Two companion hues, the page's colour turned either way round the wheel and lit: what gives
  // an aurora or a mesh its play of colour on a one-colour theme.
  warm: string;
  cool: string;
};

/** A fixed pseudo-random number in [0, 1) for part `i` of a motion: the same on every render and
 *  every machine, so a background looks the same wherever it is opened. */
export function motionSeed(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}
