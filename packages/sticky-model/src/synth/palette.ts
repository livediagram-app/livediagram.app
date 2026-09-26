import { hsvToRgb, type Rgb } from './raster';
import type { Rng } from './rng';

// The paper and the walls, as photographed rather than as swatches: every
// entry is a RANGE, because the same pad reads differently under every room's
// light, and a model shown one exact orange learns that orange and nothing
// else. Ranges are wide on purpose and cover the pale papers (lilac, pale
// yellow, pale pink) that a colour threshold loses against a white wall.

type HsvRange = { h: [number, number]; s: [number, number]; v: [number, number] };

export const PAPERS = {
  orange: { h: [22, 40], s: [0.45, 0.8], v: [0.85, 1] },
  yellow: { h: [48, 62], s: [0.45, 0.85], v: [0.85, 1] },
  paleYellow: { h: [48, 62], s: [0.18, 0.4], v: [0.9, 1] },
  blue: { h: [192, 218], s: [0.5, 0.9], v: [0.65, 0.95] },
  lilac: { h: [255, 295], s: [0.15, 0.4], v: [0.8, 0.98] },
  pink: { h: [320, 350], s: [0.3, 0.65], v: [0.9, 1] },
  hotPink: { h: [330, 355], s: [0.6, 0.85], v: [0.85, 1] },
  palePink: { h: [345, 365], s: [0.08, 0.2], v: [0.9, 1] },
  green: { h: [75, 140], s: [0.35, 0.75], v: [0.7, 0.95] },
  paleGreen: { h: [90, 150], s: [0.15, 0.35], v: [0.85, 1] },
} satisfies Record<string, HsvRange>;

export type PaperName = keyof typeof PAPERS;
export const PAPER_NAMES = Object.keys(PAPERS) as PaperName[];

// Orange is the domain event and dominates every real wall; the rest share
// what is left, so the model still sees plenty of each.
const PAPER_WEIGHTS: Record<PaperName, number> = {
  orange: 5,
  yellow: 2,
  paleYellow: 1,
  blue: 1.5,
  lilac: 1,
  pink: 1,
  hotPink: 0.7,
  palePink: 0.8,
  green: 1.2,
  paleGreen: 0.6,
};

export function pickPaper(rng: Rng): PaperName {
  const total = PAPER_NAMES.reduce((a, n) => a + PAPER_WEIGHTS[n], 0);
  let r = rng.range(0, total);
  for (const name of PAPER_NAMES) {
    r -= PAPER_WEIGHTS[name];
    if (r <= 0) return name;
  }
  return 'orange';
}

export function paperColour(rng: Rng, name: PaperName): Rgb {
  const p: HsvRange = PAPERS[name];
  return hsvToRgb(rng.range(...p.h), rng.range(...p.s), rng.range(...p.v));
}

export type Backing = 'kraft' | 'whitePaper' | 'whiteboard' | 'paintedWall' | 'bluePaper';
export const BACKINGS: readonly Backing[] = [
  'kraft',
  'whitePaper',
  'whiteboard',
  'paintedWall',
  'bluePaper',
];

export function backingColour(rng: Rng, backing: Backing): Rgb {
  switch (backing) {
    case 'kraft':
      return hsvToRgb(rng.range(26, 40), rng.range(0.25, 0.5), rng.range(0.5, 0.8));
    case 'whitePaper':
      return hsvToRgb(rng.range(0, 360), rng.range(0, 0.06), rng.range(0.82, 0.97));
    case 'whiteboard':
      return hsvToRgb(rng.range(180, 230), rng.range(0, 0.05), rng.range(0.88, 1));
    case 'paintedWall':
      return hsvToRgb(rng.range(20, 60), rng.range(0.03, 0.18), rng.range(0.6, 0.9));
    case 'bluePaper':
      return hsvToRgb(rng.range(195, 225), rng.range(0.05, 0.15), rng.range(0.8, 0.95));
  }
}
