// A start header's band colours (each product's start spec, "The header band"): the app's
// hero backdrop, drawn in the start panel's own palette rather than the brand ramp, so the band follows the app's
// light or dark look (never the tab's theme). Every colour is the palette's accent mixed into its card at a set share; the
// band's ground leans back until the title and the line both read at WCAG AA on every patch they can sit over.
import { contrastRatio } from '@liveworkspace/brand/colour';
import { mixHex } from '@liveworkspace/model-core/color-wash';

/** What the band reads of a start palette: every product's palette has these. */
export type StartBandInk = {
  card: string;
  text: string;
  muted: string;
  focus: string;
};

export type StartBandColours = {
  /** The band's ground. */
  paper: string;
  /** A shade deeper: alternate lanes, the title mark's tile. */
  soft: string;
  /** Deeper again: the other lanes, the shape kit's solids, the table. */
  wash: string;
  /** The textures' fine lines (the minor grid, the baseline grid, the rings). */
  faint: string;
  /** The textures' heavier lines (the major grid, the margin rule). */
  line: string;
  /** The art's strokes: the dimension line, the dashed slot, the ring. */
  mark: string;
  /** Small solid pieces and the title mark: the palette's accent. */
  accent: string;
  /** A card or handle lifted off the band. */
  plate: string;
  /** The line under the title: the palette's muted, leaned toward the ink where the band needs it. */
  muted: string;
};

/** WCAG AA for body text: the title and the line reach it on every patch of the band. */
export const BAND_INK_CONTRAST = 4.5;

// How much accent each band colour takes, mixed into the card, in light and in dark. Dark takes more: a dark card
// swallows a tint that a light one shows.
export const BAND_SHARES = {
  light: { paper: 0.06, soft: 0.1, wash: 0.15, faint: 0.14, line: 0.24, mark: 0.45 },
  dark: { paper: 0.1, soft: 0.15, wash: 0.22, faint: 0.16, line: 0.26, mark: 0.5 },
} as const;

// The grounds lean back by this much of their share a step at a time until the ink reads; the muted line leans
// toward the ink by this much a step.
const LEAN_STEP = 0.15;
const MUTED_STEP = 0.1;

const HEX = /^#[a-fA-F\d]{6}$/;

const isLight = (hex: string) => contrastRatio(hex, '#000000') > contrastRatio(hex, '#ffffff');

const readsOn = (ink: string, grounds: readonly string[]) =>
  grounds.every((g) => contrastRatio(ink, g) >= BAND_INK_CONTRAST);

/** The band's colours for a start palette. A palette that is not plain hex keeps a flat band: its card, no art. */
export function startBandColours(ink: StartBandInk): StartBandColours {
  const { card, text, muted, focus } = ink;
  if (![card, text, muted, focus].every((c) => HEX.test(c))) {
    return {
      paper: card,
      soft: card,
      wash: card,
      faint: 'transparent',
      line: 'transparent',
      mark: 'transparent',
      accent: focus,
      plate: card,
      muted,
    };
  }
  const light = isLight(card);
  const shares = light ? BAND_SHARES.light : BAND_SHARES.dark;
  const tint = (share: number) => mixHex(focus, card, share);
  // The grounds the words can sit on lean back together until the title reads on each.
  let lean = 1;
  let grounds = [tint(shares.paper * lean), tint(shares.soft * lean), tint(shares.wash * lean)];
  while (lean > 0 && !readsOn(text, grounds)) {
    lean = Math.max(0, lean - LEAN_STEP);
    grounds = [tint(shares.paper * lean), tint(shares.soft * lean), tint(shares.wash * lean)];
  }
  const [paper, soft, wash] = grounds as [string, string, string];
  // The line keeps the palette's muted where it reads, else leans toward the ink until it does.
  let lineInk = muted;
  for (let toward = MUTED_STEP; !readsOn(lineInk, grounds) && toward <= 1; toward += MUTED_STEP) {
    lineInk = mixHex(text, muted, Math.min(1, toward));
  }
  if (!readsOn(lineInk, grounds)) lineInk = text;
  return {
    paper,
    soft,
    wash,
    faint: tint(shares.faint),
    line: tint(shares.line),
    mark: tint(shares.mark),
    accent: focus,
    plate: light ? card : mixHex(text, card, 0.1),
    muted: lineInk,
  };
}
