// SVG text centred in a shape sits on its cap band (docs/specs/004-interface-design/optical-alignment.md).
// SVG has no text trimming, and `dominant-baseline: central` centres the em box, not the letters, so text
// keeps the alphabetic baseline and is placed half the face's cap height below the shape's centre.

/** Cap height of the UI faces, in em: they measure 0.70-0.73 (Segoe UI, SF, Roboto, Inter, DejaVu); D27. */
export const CAP_HEIGHT_EM = 0.72;

/** The alphabetic baseline that centres a text run's cap band on `centreY`. */
export function capBandBaselineY(centreY: number, fontPx: number): number {
  return centreY + (CAP_HEIGHT_EM * fontPx) / 2;
}
