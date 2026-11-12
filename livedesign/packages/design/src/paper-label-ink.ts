// Words on the plain paper keep the contrast they were made with (docs/specs/011-theme/light-and-dark.md "What a
// viewer sees"; blueprint docs/specs/011-theme/blueprints/paper-label-ink.md). A label straight on the plain paper,
// made on white, is drawn on the dark editor's slate paper with its lightness walked until it reads there as well as
// it read on white (3:1 at the least), its hue kept: a wireframe's ink, body and muted greys stay three steps, each at
// 4.5:1 or more, where the shared 3:1 walk (label-backdrop.ts) drew all three as one dim grey. Pure.
import { contrastRatio } from './colors';
import { LABEL_BACKDROP_CONTRAST, labelBackdrops } from './label-backdrop';
import { reachContrast } from './readable-colour';
import type { Element } from './index';

/** Walked inks kept, keyed by ink, paper and target: a design repeats a handful of greys. Cleared whole when full;
 *  safe range 64..4096. */
export const PAPER_INK_CACHE_SIZE = 512;

// Under this much below its made contrast a label reads as made (rounding in the walk).
const SLACK = 0.01;

const WALKED = new Map<string, string>();

function walkedInk(ink: string, paper: string, target: number): string {
  const key = `${ink}|${paper}|${target.toFixed(2)}`;
  const known = WALKED.get(key);
  if (known) return known;
  const out = reachContrast(ink, paper, target);
  if (WALKED.size >= PAPER_INK_CACHE_SIZE) WALKED.clear();
  WALKED.set(key, out);
  return out;
}

/**
 * `after` (the elements as drawn on `drawnPaper`) with each label straight on the paper, in `after` and in `before`
 * (the same elements as stored, on `storedPaper`), that reads worse on the drawn paper than it did on the stored one
 * given an ink walked in lightness to the contrast it had there, 3:1 at the least. Labels on a fill (their own, a
 * card's, a block's) are left to the 3:1 walk. The same array when nothing changes.
 */
export function withPaperLabelInks<T extends Element>(
  before: readonly Element[],
  storedPaper: string,
  after: readonly T[],
  drawnPaper: string,
): readonly T[] {
  const drawn = drawnPaper.toLowerCase();
  const stored = storedPaper.toLowerCase();
  if (drawn === stored) return after;
  const now = labelBackdrops(after, drawnPaper);
  if (now.size === 0) return after;
  const was = labelBackdrops(before, storedPaper);
  const beforeIndex = new Map(before.map((el, k) => [el.id, k] as const));
  let out: T[] | null = null;
  for (const [i, { ink, behind }] of now) {
    if (behind.toLowerCase() !== drawn) continue;
    const k = beforeIndex.get(after[i]!.id);
    const prior = k === undefined ? undefined : was.get(k);
    if (!prior || prior.behind.toLowerCase() !== stored) continue;
    const made = contrastRatio(prior.ink, prior.behind);
    if (!(contrastRatio(ink, behind) < made - SLACK)) continue;
    const next = walkedInk(ink, behind, Math.max(LABEL_BACKDROP_CONTRAST, made));
    out ??= [...after];
    out[i] = { ...after[i]!, textColor: next };
  }
  return out ?? after;
}
