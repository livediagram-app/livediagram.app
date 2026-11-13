import { describe, expect, it } from 'vitest';
import {
  buildElementIndex,
  elementGridFor,
  resolveFinish,
  type ArrowElement,
  type Element,
  type Finish,
} from '@liveplanner/project';
import { buildReferenceBoard } from '../../e2e/perf/reference-board';
import { edit, editBoard, prng } from './board-edits-test-support';
import { arrowViewGeometry, sameArrowViewFrame, sameRects } from './arrow-view-frame';
import { arrowGeometryCache } from './drag-affected-arrows';

// docs/specs/008-canvas/canvas-performance.md "A drop redraws what it reached": the layer's arrow geometry carried over
// for the arrows a change cannot reach is the geometry derived afresh, after any edit.
const fresh = (els: Element[], finish: Finish) => {
  const index = buildElementIndex(els);
  const grid = elementGridFor(els);
  return (el: Element) =>
    arrowViewGeometry(
      el as ArrowElement,
      index,
      grid,
      resolveFinish((el as ArrowElement).finish, finish),
    );
};

describe('arrowGeometryCache', () => {
  for (const finish of ['flexible', 'professional', 'sketch'] as Finish[])
    it(`carries over only what an edit cannot reach (${finish})`, () => {
      const rand = prng(finish.length * 97);
      const cache = arrowGeometryCache();
      let els = editBoard(7, 400);
      let reused = 0;
      let total = 0;
      for (let step = 0; step < 80; step++) {
        const before = cache.geometryFor(els, finish, fresh(els, finish));
        els = edit(els, rand, step);
        const got = cache.geometryFor(els, finish, fresh(els, finish));
        const want = new Map<string, ReturnType<typeof arrowViewGeometry>>();
        const derive = fresh(els, finish);
        for (const el of els) if (el.type === 'arrow') want.set(el.id, derive(el));
        expect([...got.keys()]).toEqual([...want.keys()]);
        for (const [id, g] of want) {
          const h = got.get(id)!;
          expect(
            sameArrowViewFrame(h.frame, g.frame) && sameRects(h.holes, g.holes),
            `${id} at ${step}`,
          ).toBe(true);
          if (h === before.get(id)) reused++;
          total++;
        }
      }
      // Most arrows are carried over: an edit reaches its neighbours, not the board.
      expect(reused / total).toBeGreaterThan(0.5);
    });

  it('derives every arrow afresh for a new key', () => {
    const cache = arrowGeometryCache();
    const els = buildReferenceBoard(3, 120) as Element[];
    const a = cache.geometryFor(els, 'flexible', fresh(els, 'flexible'));
    const b = cache.geometryFor(els, 'sketch', fresh(els, 'sketch'));
    const id = [...a.keys()][0]!;
    expect(b.get(id)).not.toBe(a.get(id));
    // The same board again carries every arrow over.
    const c = cache.geometryFor(els, 'sketch', fresh(els, 'sketch'));
    expect([...c].every(([k, v]) => b.get(k) === v)).toBe(true);
  });
});
