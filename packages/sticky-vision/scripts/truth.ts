import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Truth, TruthNote } from '../src/truth';

// Scoring the detector against notes a human labelled, because a COUNT cannot
// tell a fix from a regression once false positives are in play: a change that
// finds two more notes and invents five scores higher on "how many did we
// find" and is a loss.
//
// The labels describe somebody's real wall, so they follow the photographs out
// of this public repo and live beside them in the operator's own data
// directory:
//
//   ~/.local/share/eswall-truth/<photo>.json      (override: ESWALL_TRUTH_DIR)
//
// A file is `{ photo, labelledOn: { width, height }, notes: [{ x, y, w, h,
// kind }] }` with every box in FRACTIONS of the image, so the labels survive
// any working size. They are read by eye off a grid drawn over the working
// image; centres are what matters, sizes are nominal per kind, and the match
// rule below is loose enough for that to be honest.

// The FORMAT lives in `src/truth.ts`, because the editor writes labels as
// well as reading them; the SCORING is here, because it is a tool's job.
export type { Truth, TruthNote } from '../src/truth';

export type ScoredBox = { x: number; y: number; w: number; h: number; kind: string };

export type Score = {
  truth: number;
  detected: number;
  matched: number;
  precision: number;
  recall: number;
  f1: number;
  kindsRight: number;
  missed: TruthNote[];
  spurious: ScoredBox[];
};

// WHERE THE TRUTH LIVES. The photographs and their labels are kept in a
// private repository (`vision-model-truths`), because they are somebody's
// real walls and hours of hand-labelling — too sensitive for this public repo
// and too expensive to lose on one disk. Found, in order:
//
//   $VISION_TRUTHS_DIR                      an explicit checkout
//   <this repo>/../vision-model-truths      a sibling clone, the convention
//
// and inside it, `event-storming/photos` and `event-storming/labels`. With no
// checkout at all the tools fall back to the old local folders, so a fresh
// clone of this repo still runs the sweep on whatever photos it is given.
const REPO_ROOT = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const TASK = 'event-storming';

export function truthsRoot(): string | null {
  const candidates = [
    process.env.VISION_TRUTHS_DIR,
    resolve(REPO_ROOT, '..', 'vision-model-truths'),
  ].filter((c): c is string => c !== undefined && c !== '');
  return candidates.find((c) => existsSync(`${c}/${TASK}`)) ?? null;
}

export const truthDir = (): string => {
  if (process.env.ESWALL_TRUTH_DIR) return process.env.ESWALL_TRUTH_DIR;
  const root = truthsRoot();
  return root ? `${root}/${TASK}/labels` : `${homedir()}/.local/share/eswall-truth`;
};

export const photoDir = (): string => {
  const root = truthsRoot();
  return root ? `${root}/${TASK}/photos` : fileURLToPath(new URL('../test-files', import.meta.url));
};

export function truthFor(photo: string): Truth | null {
  const stem = photo.replace(/\.[^.]+$/, '');
  const path = `${truthDir()}/${stem}.json`;
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as Truth;
}

// A detection matches a label when their centres are within half a note and
// their areas are within 2x. The area test is what makes a merged 2x2 cluster
// score as it should: one spurious box AND four missing notes, rather than a
// generous hit on whichever note its centre happens to land nearest.
const CENTRE_TOLERANCE = 0.5;
const AREA_RATIO = 2;

export function score(truth: Truth, boxes: ScoredBox[], width: number, height: number): Score {
  const labels = truth.notes.map((n) => ({
    ...n,
    cx: (n.x + n.w / 2) * width,
    cy: (n.y + n.h / 2) * height,
    px: n.w * width,
    py: n.h * height,
  }));
  const taken = new Set<number>();
  const matchOf = new Map<number, number>();
  // Greedy, nearest first: every (detection, label) pair that could match,
  // sorted by centre distance, so a box between two notes goes to the nearer.
  const pairs: { d: number; b: number; l: number }[] = [];
  boxes.forEach((b, bi) => {
    const bcx = b.x + b.w / 2;
    const bcy = b.y + b.h / 2;
    const barea = b.w * b.h;
    labels.forEach((l, li) => {
      const reach = Math.max(l.px, l.py) * CENTRE_TOLERANCE;
      const d = Math.hypot(bcx - l.cx, bcy - l.cy);
      if (d > reach) return;
      const ratio = barea / (l.px * l.py);
      if (ratio > AREA_RATIO || ratio < 1 / AREA_RATIO) return;
      pairs.push({ d, b: bi, l: li });
    });
  });
  pairs.sort((a, b) => a.d - b.d);
  for (const p of pairs) {
    if (matchOf.has(p.b) || taken.has(p.l)) continue;
    matchOf.set(p.b, p.l);
    taken.add(p.l);
  }

  const matched = matchOf.size;
  const precision = boxes.length === 0 ? 0 : matched / boxes.length;
  const recall = labels.length === 0 ? 0 : matched / labels.length;
  const kindsRight = [...matchOf].filter(([b, l]) => boxes[b]!.kind === labels[l]!.kind).length;
  return {
    truth: labels.length,
    detected: boxes.length,
    matched,
    precision,
    recall,
    f1: precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall),
    kindsRight,
    missed: truth.notes.filter((_, i) => !taken.has(i)),
    spurious: boxes.filter((_, i) => !matchOf.has(i)),
  };
}
