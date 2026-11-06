// The shared rule behind "Snapping on a page" (docs/specs/007-editor/pages-mode.md in livedocuments and livedesign).
import { describe, expect, it } from 'vitest';
import { snapScope, type SnapBox } from './page-snap-scope';

type El = { id: string; box?: SnapBox };
type Pg = { id: string; x: number; width: number };

// Two pages side by side, 100 wide with a 20 gap.
const pages: Pg[] = [
  { id: 'p1', x: 0, width: 100 },
  { id: 'p2', x: 120, width: 100 },
];
const how = {
  pageAt: (ps: readonly Pg[], pt: { x: number }) =>
    ps.find((p) => pt.x >= p.x && pt.x <= p.x + p.width),
  boxOf: (el: El) => el.box,
};
const at = (id: string, x: number): El => ({ id, box: { x, y: 0, width: 10, height: 10 } });
const ids = (els: El[]) => els.map((e) => e.id);

describe('snapScope', () => {
  const elements = [at('a', 10), at('b', 130), at('off', 105), { id: 'arrow' }];
  const boxes = [at('edge:p1', 0), at('edge:p2', 120)];

  it("keeps to the page under the box's centre, and its own snap boxes", () => {
    const scope = snapScope(elements, boxes, pages, at('m', 50).box!, how);
    expect(ids(scope.spaced)).toEqual(['a']);
    expect(ids(scope.aligned)).toEqual(['a', 'edge:p1']);
  });

  it('off every page, keeps to what is off every page, with no page lines', () => {
    const scope = snapScope(elements, boxes, pages, at('m', 104).box!, how);
    expect(ids(scope.aligned)).toEqual(['off']);
  });

  it('with no page boxes, aligns to what it spaces against', () => {
    const scope = snapScope(elements, undefined, pages, at('m', 140).box!, how);
    expect(scope.aligned).toBe(scope.spaced);
    expect(ids(scope.spaced)).toEqual(['b']);
  });

  it('outside Pages mode, everything, the page boxes added for aligning', () => {
    expect(snapScope(elements, boxes, undefined, at('m', 50).box!, how).aligned).toHaveLength(6);
    const bare = snapScope(elements, undefined, [], at('m', 50).box!, how);
    expect(bare.spaced).toBe(elements);
    expect(bare.aligned).toBe(elements);
  });
});
