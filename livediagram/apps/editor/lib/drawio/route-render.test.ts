// @vitest-environment jsdom
// The renderer draws an imported route as stored (spec "Edges", draw.io's route exactly): an
// angled arrow's corners need no squaring to meet their pinned ends. The one exception is accepted
// (spec "Accepted losses"): a slanted line's first and last leg come in squared, because the
// renderer lines the corner next to a pinned end up with it on the anchor's axis, and a straight
// edge's waypoints leave their ends at a slant.
import { describe, expect, it } from 'vitest';
import {
  angledCornerPoints,
  arrowStyleOf,
  buildElementIndex,
  curveAnchorPoints,
  endpointPosition,
  type ArrowElement,
} from '@livediagram/document';
import { axisOf } from './arrow-route';
import { importDrawio } from './import';
import { fixtureBytes } from './test-support';

async function arrowsOf(name: string) {
  const result = await importDrawio(
    { kind: 'bytes', bytes: fixtureBytes(name) },
    { tabIdForPage: (i) => `tab-${i}` },
  );
  if (!result.ok) throw new Error(result.error);
  return result.pages.flatMap((page) => {
    const index = buildElementIndex(page.elements);
    return page.elements
      .filter((e): e is ArrowElement => e.type === 'arrow')
      .map((arrow) => ({ page: page.name, arrow, index }));
  });
}

describe.each(['routes.drawio', 'flowchart.drawio', 'swimlanes.drawio', 'uml.drawio'])(
  '%s',
  (name) => {
    it('draws every angled route through its stored corners, squaring only a slanted line’s end legs (accepted loss)', async () => {
      const angled = (await arrowsOf(name)).filter(
        ({ arrow }) => arrowStyleOf(arrow) === 'angled' && arrow.curvePoints,
      );
      for (const { page, arrow, index } of angled) {
        const from = endpointPosition(arrow.from, index);
        const to = endpointPosition(arrow.to, index);
        const stored = curveAnchorPoints(from, to, arrow.curvePoints!);
        const drawn = angledCornerPoints(from, to, arrow.curvePoints!, arrow.from, arrow.to);
        const last = stored.length - 1;
        // The corner next to a pinned end whose stored leg is slanted moves onto the anchor's axis.
        const squared = (i: number) =>
          (i === 0 && arrow.from.kind === 'pinned' && !axisOf(from, stored[0]!)) ||
          (i === last && arrow.to.kind === 'pinned' && !axisOf(stored[last]!, to));
        drawn.forEach((p, i) => {
          if (squared(i)) {
            const end = i === 0 ? from : to;
            const onEnd = Math.abs(p.x - end.x) < 1e-6 || Math.abs(p.y - end.y) < 1e-6;
            const keepsOne =
              Math.abs(p.x - stored[i]!.x) < 1e-6 || Math.abs(p.y - stored[i]!.y) < 1e-6;
            expect(onEnd && keepsOne, `${page}: squared corner ${i}`).toBe(true);
            return;
          }
          expect(p.x, `${page}: corner ${i} x`).toBeCloseTo(stored[i]!.x, 6);
          expect(p.y, `${page}: corner ${i} y`).toBeCloseTo(stored[i]!.y, 6);
        });
      }
    });
  },
);
