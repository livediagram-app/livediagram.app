// The quick portraits on the Doodle Warm-Up (template-doodle-warmup.ts): a face drawn in under a
// minute, with its eyes, nose, grin and one of four hairstyles, glasses optional. Split from the
// shared doodles (template-sketch-figures.ts) to keep each file cohesive. Pure.

import type { FreehandElement } from '@livediagram/document';
import { arcPts } from './template-sketch-figures';
import { BOLD, FINE, drawn, ellipsePath, many, type Pen, type Pt } from './template-sketch-kit';

const P = (x: number, y: number): Pt => ({ x, y });

export type PortraitOpts = { glasses?: boolean; hair: 'curls' | 'bun' | 'spikes' | 'fringe' };

// A sixty-second portrait: face, eyes, nose, grin and hair, the face centred on (cx, cy).
export function portrait(
  cx: number,
  cy: number,
  r: number,
  seed: number,
  opts: PortraitOpts,
  pen: Pen = {},
) {
  const marks: FreehandElement[] = [
    drawn(ellipsePath(cx, cy, r * 0.85, r, seed, 1.05), seed, pen),
    drawn(
      arcPts(cx, cy + r * 0.25, r * 0.4, r * 0.3, 0.15 * Math.PI, 0.85 * Math.PI, 8),
      seed + 1,
      pen,
    ),
    drawn(
      [P(cx, cy - r * 0.05), P(cx - r * 0.1, cy + r * 0.2), P(cx + r * 0.05, cy + r * 0.22)],
      seed + 2,
      {
        ...pen,
        width: FINE,
        amp: 0.3,
      },
    ),
  ];
  const ex = r * 0.33;
  const ey = cy - r * 0.2;
  if (opts.glasses) {
    marks.push(
      drawn(ellipsePath(cx - ex, ey, r * 0.22, r * 0.18, seed + 3), seed + 3, pen),
      drawn(ellipsePath(cx + ex, ey, r * 0.22, r * 0.18, seed + 4), seed + 4, pen),
      drawn([P(cx - ex + r * 0.22, ey), P(cx + ex - r * 0.22, ey)], seed + 5, { ...pen, amp: 0.2 }),
    );
  }
  marks.push(
    ...many(
      [
        ellipsePath(cx - ex, ey, r * 0.05, r * 0.06, seed + 6, 2),
        ellipsePath(cx + ex, ey, r * 0.05, r * 0.06, seed + 7, 2),
      ],
      seed + 6,
      { ...pen, width: BOLD, amp: 0.1 },
    ),
  );
  const top = cy - r;
  if (opts.hair === 'curls') {
    const curls = Array.from({ length: 7 }, (_, k) => {
      const a = Math.PI * (1.05 + (k / 6) * 0.9);
      return ellipsePath(
        cx + r * 0.95 * Math.cos(a),
        cy + r * 1.0 * Math.sin(a),
        r * 0.17,
        r * 0.15,
        seed + k,
        1.3,
      );
    });
    marks.push(...many(curls, seed + 10, { ...pen, amp: 0.4 }));
  } else if (opts.hair === 'bun') {
    marks.push(
      drawn(ellipsePath(cx, top - r * 0.3, r * 0.3, r * 0.25, seed + 11), seed + 11, pen),
      drawn(
        arcPts(cx, cy + r * 0.05, r * 1.0, r * 1.12, 0.95 * Math.PI, 2.05 * Math.PI, 14),
        seed + 12,
        pen,
      ),
      drawn(
        [
          P(cx + r * 0.05, top - r * 0.08),
          P(cx - r * 0.25, cy - r * 0.7),
          P(cx - r * 0.75, cy - r * 0.45),
        ],
        seed + 13,
        pen,
      ),
    );
  } else if (opts.hair === 'spikes') {
    const spikes: Pt[] = [];
    for (let k = 0; k <= 8; k++) {
      const a = Math.PI * (1.1 + (k / 8) * 0.8);
      const out = k % 2 === 0 ? 1.0 : 1.3;
      spikes.push(P(cx + r * out * 0.85 * Math.cos(a), cy + r * out * Math.sin(a)));
    }
    marks.push(drawn(spikes, seed + 13, pen));
  } else {
    marks.push(
      drawn(
        [
          P(cx - r * 0.85, cy - r * 0.15),
          P(cx - r * 0.7, cy - r * 0.8),
          P(cx, top - r * 0.08),
          P(cx + r * 0.7, cy - r * 0.8),
          P(cx + r * 0.85, cy - r * 0.15),
          P(cx + r * 0.5, cy - r * 0.6),
          P(cx - r * 0.2, cy - r * 0.55),
          P(cx - r * 0.85, cy - r * 0.15),
        ],
        seed + 14,
        pen,
      ),
    );
  }
  return marks;
}
