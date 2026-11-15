// Which face draws a letter (docs/specs/007-editor/logo-pages.md "Outlined text"): CSS font matching (CSS Fonts 4
// §5.2) over the faces an export embeds, so an outline uses the very face the browser painted, and whether the
// browser synthesised a bold or an italic the face lacks.
import type { FaceSource } from './font-face-css';

export type FaceMatch = {
  face: FaceSource;
  // The weight the face is drawn at: the asked weight within the face's range.
  weight: number;
  syntheticBold: boolean;
  syntheticItalic: boolean;
};

// The weight from which bold is asked for, and a face under which the browser thickens the letters itself.
const BOLD_THRESHOLD = 600;

const STYLE_ORDER = {
  normal: ['normal', 'oblique', 'italic'],
  italic: ['italic', 'oblique', 'normal'],
} as const;

function covers(face: FaceSource, cp: number): boolean {
  return face.ranges.some(([lo, hi]) => cp >= lo && cp <= hi);
}

// The face whose weight the browser picks for `w` (CSS Fonts 4 "font-weight" matching).
function byWeight(faces: readonly FaceSource[], w: number): FaceSource {
  const inside = faces.find((f) => w >= f.weight[0] && w <= f.weight[1]);
  if (inside) return inside;
  const above = faces.filter((f) => f.weight[0] > w).sort((a, b) => a.weight[0] - b.weight[0]);
  const below = faces.filter((f) => f.weight[1] < w).sort((a, b) => b.weight[1] - a.weight[1]);
  if (w >= 400 && w <= 500) {
    const upTo500 = above.filter((f) => f.weight[0] <= 500);
    const past500 = above.filter((f) => f.weight[0] > 500);
    return (upTo500[0] ?? below[0] ?? past500[0])!;
  }
  return (w < 400 ? (below[0] ?? above[0]) : (above[0] ?? below[0]))!;
}

/** The face that draws `codePoint` in `family` at `weight` and `italic`, or null when none of the family's faces
 *  covers it (the browser then fell back to another font). */
export function matchFace(
  faces: readonly FaceSource[],
  family: string,
  weight: number,
  italic: boolean,
  codePoint: number,
): FaceMatch | null {
  const name = family.toLowerCase();
  const candidates = faces.filter((f) => f.family.toLowerCase() === name && covers(f, codePoint));
  if (candidates.length === 0) return null;
  const style = STYLE_ORDER[italic ? 'italic' : 'normal'].find((s) =>
    candidates.some((f) => f.style === s),
  )!;
  const face = byWeight(
    candidates.filter((f) => f.style === style),
    weight,
  );
  return {
    face,
    weight: Math.min(face.weight[1], Math.max(face.weight[0], weight)),
    syntheticBold: weight >= BOLD_THRESHOLD && face.weight[1] < BOLD_THRESHOLD,
    syntheticItalic: italic && face.style === 'normal',
  };
}
