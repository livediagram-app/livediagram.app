import { describe, expect, it } from 'vitest';
import {
  anchorPosition,
  bestAnchorTowards,
  bringManyToFront,
  bringToFront,
  elementBounds,
  endpointPosition,
  isBoxed,
  rankAnchorsTowards,
  rebindArrowAnchorsAfterMove,
  sendManyToBack,
  sendToBack,
  snapToAnchor,
  supportsBorder,
  supportsColours,
  type ArrowElement,
  type Element,
  type ShapeElement,
} from './index';

const shape = (id: string, overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 80,
  ...overrides,
});

describe('anchorPosition', () => {
  const box = shape('a', { x: 10, y: 20, width: 100, height: 80 });

  it('places each of the eight anchors on the box edges', () => {
    expect(anchorPosition(box, 'nw')).toEqual({ x: 10, y: 20 });
    expect(anchorPosition(box, 'n')).toEqual({ x: 60, y: 20 });
    expect(anchorPosition(box, 'ne')).toEqual({ x: 110, y: 20 });
    expect(anchorPosition(box, 'e')).toEqual({ x: 110, y: 60 });
    expect(anchorPosition(box, 'se')).toEqual({ x: 110, y: 100 });
    expect(anchorPosition(box, 's')).toEqual({ x: 60, y: 100 });
    expect(anchorPosition(box, 'sw')).toEqual({ x: 10, y: 100 });
    expect(anchorPosition(box, 'w')).toEqual({ x: 10, y: 60 });
  });

  it('treats rotation 0 / absent as unrotated', () => {
    expect(anchorPosition(shape('a', { rotation: 0 }), 'e')).toEqual({ x: 100, y: 40 });
  });

  it('anchors a Technology icon on its fixed-size mark, not the element box (spec/41)', () => {
    // 200x100 box, no label: the md (48px) mark centres at (76..124, 26..74),
    // so connectors touch the visible chip instead of floating on the box edge.
    const tech = shape('t', { shape: 'icon', iconId: 'aws-ec2', width: 200, height: 100 });
    expect(anchorPosition(tech, 'e')).toEqual({ x: 124, y: 50 });
    expect(anchorPosition(tech, 's')).toEqual({ x: 100, y: 74 });
    // A line-art icon keeps box anchors — its glyph scales with the box.
    const line = shape('l', { shape: 'icon', iconId: 'server', width: 200, height: 100 });
    expect(anchorPosition(line, 'e')).toEqual({ x: 200, y: 50 });
  });

  it("pushes a captioned tech icon's caption-side anchor to the element edge", () => {
    // 200x100 box with a bottom caption: band y 6..64, so the 48px mark sits
    // at (76, 11)..(124, 59). Side anchors stay on the chip; the SOUTH anchor
    // (the caption's side) pushes to the element's bottom line so a downward
    // connector starts under the text instead of crossing it.
    const tech = shape('t', {
      shape: 'icon',
      iconId: 'aws-ec2',
      width: 200,
      height: 100,
      label: 'EC2',
    });
    expect(anchorPosition(tech, 'e')).toEqual({ x: 124, y: 35 });
    const n = anchorPosition(tech, 'n');
    expect(n.x).toBe(100);
    expect(n.y).toBeCloseTo(11);
    expect(anchorPosition(tech, 's')).toEqual({ x: 100, y: 100 });
    // Top-aligned caption mirrors: the NORTH anchor pushes to the top line.
    const topCap = shape('t2', {
      shape: 'icon',
      iconId: 'aws-ec2',
      width: 200,
      height: 100,
      label: 'EC2',
      textAlignY: 'top',
    });
    expect(anchorPosition(topCap, 'n')).toEqual({ x: 100, y: 0 });
    expect(anchorPosition(topCap, 's').y).toBeCloseTo(89); // mark bottom (band y 36..94, 48px mark centred)
  });

  it('projects diamond anchors onto the diamond outline (corners land on the slanted edge)', () => {
    const d = shape('d', { shape: 'diamond', x: 0, y: 0, width: 100, height: 100 });
    // Cardinal anchors are the diamond's tips already — unchanged.
    expect(anchorPosition(d, 'n')).toEqual({ x: 50, y: 0 });
    expect(anchorPosition(d, 'e')).toEqual({ x: 100, y: 50 });
    // The NE bbox corner (100,0) is empty space outside the diamond; it
    // projects to the midpoint of the top-right edge instead of floating.
    const ne = anchorPosition(d, 'ne');
    expect(ne.x).toBeCloseTo(75, 6);
    expect(ne.y).toBeCloseTo(25, 6);
  });

  it('projects circle anchors onto the ellipse (corners pull in to the curve)', () => {
    const c = shape('c', { shape: 'circle', x: 0, y: 0, width: 100, height: 100 });
    // Cardinals sit on the circle already.
    expect(anchorPosition(c, 'e')).toEqual({ x: 100, y: 50 });
    // The NE corner pulls in to the 45deg point on the circle (r=50).
    const ne = anchorPosition(c, 'ne');
    expect(ne.x).toBeCloseTo(50 + 50 / Math.SQRT2, 6);
    expect(ne.y).toBeCloseTo(50 - 50 / Math.SQRT2, 6);
  });

  it('leaves rectangular shapes (square / text / table) on the bounding box', () => {
    const sq = shape('s', { shape: 'square', x: 0, y: 0, width: 100, height: 100 });
    expect(anchorPosition(sq, 'ne')).toEqual({ x: 100, y: 0 });
  });

  it('rotates the anchor about the element centre (90deg clockwise)', () => {
    // Square at (0,0) 100x100, centre (50,50), spun 90deg clockwise:
    // each edge anchor moves a quarter-turn round the centre.
    const sq = shape('s', { width: 100, height: 100, rotation: 90 });
    const close = (p: { x: number; y: number }, x: number, y: number) => {
      expect(p.x).toBeCloseTo(x, 6);
      expect(p.y).toBeCloseTo(y, 6);
    };
    close(anchorPosition(sq, 'e'), 50, 100); // east edge swings to the south
    close(anchorPosition(sq, 'n'), 100, 50); // north edge swings to the east
    close(anchorPosition(sq, 'nw'), 100, 0); // nw corner swings to the ne corner
  });
});

describe('endpointPosition', () => {
  const target = shape('t', { x: 0, y: 0, width: 100, height: 100 });

  it('returns the literal coordinates of a free endpoint', () => {
    expect(endpointPosition({ kind: 'free', x: 7, y: 9 }, [])).toEqual({ x: 7, y: 9 });
  });

  it('resolves a pinned endpoint through its target anchor', () => {
    expect(endpointPosition({ kind: 'pinned', elementId: 't', anchor: 'se' }, [target])).toEqual({
      x: 100,
      y: 100,
    });
  });

  it('falls back to the origin when the pinned target is missing', () => {
    expect(endpointPosition({ kind: 'pinned', elementId: 'gone', anchor: 'n' }, [target])).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('resolves an on-arrow endpoint to a point along the target arrow (spec/50)', () => {
    // A straight arrow from (0,0) to (100,0); t=0.5 is its midpoint.
    const line: ArrowElement = {
      id: 'line',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'free', x: 100, y: 0 },
    };
    const p = endpointPosition({ kind: 'on-arrow', arrowId: 'line', t: 0.5 }, [line]);
    expect(p.x).toBeCloseTo(50, 5);
    expect(p.y).toBeCloseTo(0, 5);
    // t=0 / t=1 land on the target's own endpoints.
    expect(endpointPosition({ kind: 'on-arrow', arrowId: 'line', t: 0 }, [line])).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('resolves a pinned-group endpoint from the live union bounds (spec/09)', () => {
    const els = [shape('a', { groupId: 'g' }), shape('b', { x: 200, y: 0, groupId: 'g' })];
    const ep = { kind: 'pinned-group', groupId: 'g', anchor: 's' } as const;
    // Union spans x 0..300, y 0..80 -> south midpoint (150, 80).
    expect(endpointPosition(ep, els)).toEqual({ x: 150, y: 80 });
    // Moving a member moves the resolved point: the arrow tracks the group.
    const moved = els.map((el) => (el.id === 'b' ? { ...el, y: 100 } : el));
    expect(endpointPosition(ep, moved)).toEqual({ x: 150, y: 180 });
  });

  it('falls back to the origin when the on-arrow target is missing', () => {
    expect(endpointPosition({ kind: 'on-arrow', arrowId: 'gone', t: 0.5 }, [target])).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe('elementBounds', () => {
  it('returns a boxed element rectangle directly', () => {
    const box = shape('a', { x: 5, y: 6, width: 30, height: 40 });
    expect(elementBounds(box, [box])).toEqual({ x: 5, y: 6, width: 30, height: 40 });
  });

  it('derives an arrow AABB from its endpoints regardless of direction', () => {
    const arrow: ArrowElement = {
      id: 'e',
      type: 'arrow',
      from: { kind: 'free', x: 100, y: 80 },
      to: { kind: 'free', x: 20, y: 10 },
    };
    expect(elementBounds(arrow, [])).toEqual({ x: 20, y: 10, width: 80, height: 70 });
  });
});

describe('snapToAnchor', () => {
  const box = shape('a', { x: 0, y: 0, width: 100, height: 100 });

  it('returns the nearest anchor within the threshold', () => {
    // Just outside the NE corner (100, 0).
    expect(snapToAnchor({ x: 104, y: 3 }, [box], 10)).toEqual({
      elementId: 'a',
      anchor: 'ne',
    });
  });

  it('returns null when no anchor is within the threshold', () => {
    expect(snapToAnchor({ x: 500, y: 500 }, [box], 10)).toBeNull();
  });

  it('ignores arrows (only boxed elements have anchors)', () => {
    const arrow: ArrowElement = {
      id: 'e',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'free', x: 10, y: 10 },
    };
    expect(snapToAnchor({ x: 0, y: 0 }, [arrow], 10)).toBeNull();
  });
});

describe('bestAnchorTowards', () => {
  // A 100x80 box centred at (60, 60). Used for every directional case
  // so the test names read like a compass.
  const box = shape('a', { x: 10, y: 20, width: 100, height: 80 });

  it('picks the east cardinal when the target is purely to the right', () => {
    expect(bestAnchorTowards(box, { x: 300, y: 60 })).toBe('e');
  });
  it('picks the west cardinal when the target is purely to the left', () => {
    expect(bestAnchorTowards(box, { x: -300, y: 60 })).toBe('w');
  });
  it('picks the south cardinal when the target is purely below', () => {
    expect(bestAnchorTowards(box, { x: 60, y: 400 })).toBe('s');
  });
  it('picks the north cardinal when the target is purely above', () => {
    expect(bestAnchorTowards(box, { x: 60, y: -400 })).toBe('n');
  });
  it('keeps the side face when the direction is flatter than the box corner', () => {
    // box corner sits at atan2(40,50)=38.7deg; dx=200, dy=80 is ~21.8deg,
    // flatter than the corner, so the centre->target ray exits the east face.
    expect(bestAnchorTowards(box, { x: 260, y: 140 })).toBe('e');
  });
  it('exits through the face the centre->target line actually crosses (aspect-ratio aware)', () => {
    // The 100x80 box's corner diagonal is 38.7deg below horizontal. A 45deg
    // target is STEEPER than the corner, so the connecting line leaves
    // through the top/bottom face — not the side the old nearest-midpoint
    // metric used to pick. Auto-anchoring stays cardinal-only.
    expect(bestAnchorTowards(box, { x: 160, y: 160 })).toBe('s');
    expect(bestAnchorTowards(box, { x: 160, y: -40 })).toBe('n');
    expect(bestAnchorTowards(box, { x: -40, y: 160 })).toBe('s');
    expect(bestAnchorTowards(box, { x: -40, y: -40 })).toBe('n');
  });
  it('uses the box aspect ratio: a wide box and a tall box disagree on the same target', () => {
    const wide = shape('w', { x: 0, y: 40, width: 120, height: 40 }); // centre (60,60)
    const tall = shape('t', { x: 40, y: 0, width: 40, height: 120 }); // centre (60,60)
    // Wide box corner at atan2(20,60)=18.4deg; 45deg target is steeper -> top/bottom.
    expect(bestAnchorTowards(wide, { x: 110, y: 110 })).toBe('s');
    // Tall box corner at atan2(60,20)=71.6deg; 45deg target is flatter -> side.
    expect(bestAnchorTowards(tall, { x: 110, y: 110 })).toBe('e');
  });
  it('holds the current face through the corner dead-band, then switches when decisively past it', () => {
    const sq = shape('s', { x: 0, y: 0, width: 100, height: 100 }); // centre (50,50)
    // Target just past the diagonal: the raw pick is 's', but an arrow
    // already on 'e' stays 'e' inside the hysteresis band...
    expect(bestAnchorTowards(sq, { x: 160, y: 175 })).toBe('s');
    expect(bestAnchorTowards(sq, { x: 160, y: 175 }, 'e')).toBe('e');
    // ...and commits to 's' once the vertical lead clears the margin.
    expect(bestAnchorTowards(sq, { x: 160, y: 250 }, 'e')).toBe('s');
    // A sign flip on the same axis is never damped: e -> w as the target
    // crosses to the left.
    expect(bestAnchorTowards(sq, { x: -160, y: 60 }, 'e')).toBe('w');
  });
  it('skips faces in the avoid set so a second connector lands on a free face', () => {
    const sq = shape('s', { x: 0, y: 0, width: 100, height: 100 }); // centre (50,50)
    // A target straight to the right would pick 'e'; with 'e' taken it
    // falls to the next-best free face.
    expect(bestAnchorTowards(sq, { x: 400, y: 50 })).toBe('e');
    expect(bestAnchorTowards(sq, { x: 400, y: 60 }, undefined, new Set(['e'] as const))).not.toBe(
      'e',
    );
  });
  it('accounts for rotation: a 90deg-CW box facing a target to the east picks its local north face', () => {
    // Spun 90deg clockwise, the local north edge now points east in
    // world space, so a target to the right resolves to the 'n' anchor
    // (which anchorPosition then rotates back out to the east side).
    const spun = shape('a', { x: 10, y: 20, width: 100, height: 80, rotation: 90 });
    expect(bestAnchorTowards(spun, { x: 300, y: 60 })).toBe('n');
  });
});

describe('rankAnchorsTowards', () => {
  const sq = shape('s', { x: 0, y: 0, width: 100, height: 100 }); // centre (50,50)

  it('ranks the faces best-first, exit face leading', () => {
    expect(rankAnchorsTowards(sq, { x: 400, y: 60 }).ranked[0]).toBe('e');
    // A faint up-right target leaves east first, then north, with the
    // back faces (s, w) last.
    const { ranked } = rankAnchorsTowards(sq, { x: 400, y: -10 });
    expect(ranked.slice(0, 2)).toEqual(['e', 'n']);
  });

  it('reports a higher commitment the more head-on the target is', () => {
    const headOn = rankAnchorsTowards(sq, { x: 400, y: 50 }).commitment; // due east
    const diagonal = rankAnchorsTowards(sq, { x: 130, y: 120 }).commitment; // near 45deg
    expect(headOn).toBeGreaterThan(diagonal);
  });
});

describe('rebindArrowAnchorsAfterMove', () => {
  // Two boxes + a pinned-to-pinned arrow between them. The default
  // anchors point east-from-a, west-into-b (a classic LTR connector).
  // Tests drag various boxes around and assert the helper picks the
  // face the arrow should switch to.
  const a = (): ShapeElement =>
    ({ id: 'a', type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 80 }) as const;
  const b = (overrides: Partial<ShapeElement> = {}): ShapeElement =>
    ({
      id: 'b',
      type: 'shape',
      shape: 'square',
      x: 200,
      y: 0,
      width: 100,
      height: 80,
      ...overrides,
    }) as const;
  const arrow = (): ArrowElement =>
    ({
      id: 'arr',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
      to: { kind: 'pinned', elementId: 'b', anchor: 'w' },
    }) as const;

  it('returns the same arrow when no endpoint is in the moving set', () => {
    const els: Element[] = [a(), b(), arrow()];
    const out = rebindArrowAnchorsAfterMove(els, new Set(['unrelated']));
    expect(out[2]).toEqual(els[2]);
  });

  it('keeps the opposing e/w pair for side-by-side boxes with a vertical offset', () => {
    // b sits to the right of a but 60px higher — their vertical spans
    // still overlap, so the connection reads as a ROW. Aiming at b's
    // CENTRE used to exit a through its top face (a.n), a visually
    // wrong, inconsistent pair; the clamped aim keeps a.e -> b.w.
    const els: Element[] = [a(), b({ y: -60 }), arrow()];
    const out = rebindArrowAnchorsAfterMove(els, new Set(['b']));
    const next = out[2] as ArrowElement;
    expect(next.from.kind === 'pinned' && next.from.anchor).toBe('e');
    expect(next.to.kind === 'pinned' && next.to.anchor).toBe('w');
  });

  it('keeps the opposing s/n pair for stacked boxes with a horizontal offset', () => {
    // b below a, shifted 60px right — horizontal spans still overlap,
    // so the connection reads as a COLUMN: a.s -> b.n.
    const els: Element[] = [a(), b({ x: 60, y: 220 }), arrow()];
    const out = rebindArrowAnchorsAfterMove(els, new Set(['b']));
    const next = out[2] as ArrowElement;
    expect(next.from.kind === 'pinned' && next.from.anchor).toBe('s');
    expect(next.to.kind === 'pinned' && next.to.anchor).toBe('n');
  });

  it('gives every row sibling the same face pair (consistent connections)', () => {
    // A hub with two right-hand neighbours at different heights, both
    // overlapping the hub's vertical span: both connectors should use
    // the SAME e -> w pair rather than one grabbing the hub's corner
    // diagonal (distribution then steps the second endpoint to its
    // next-best face, but the TARGET ends stay consistent w's).
    const hub = a();
    const top: ShapeElement = { ...b({ y: -50 }), id: 'top' };
    const bottom: ShapeElement = { ...b({ y: 50 }), id: 'bottom' };
    const arrTop: ArrowElement = {
      id: 'arr-top',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
      to: { kind: 'pinned', elementId: 'top', anchor: 'w' },
    };
    const arrBottom: ArrowElement = {
      id: 'arr-bottom',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
      to: { kind: 'pinned', elementId: 'bottom', anchor: 'w' },
    };
    const els: Element[] = [hub, top, bottom, arrTop, arrBottom];
    const out = rebindArrowAnchorsAfterMove(els, new Set(['a']));
    for (const id of ['arr-top', 'arr-bottom']) {
      const next = out.find((e) => e.id === id) as ArrowElement;
      expect(next.to.kind === 'pinned' && next.to.anchor).toBe('w');
    }
  });

  it('re-centres a stale wrong-side corner instead of crossing its sibling', () => {
    // A hub over two children. The arrow to the RIGHT child carries a stale
    // 'sw' anchor (picked while its child was still on the left); the arrow
    // to the LEFT child sits on the shared bottom centre. Moving the right
    // child must NOT keep the corner via the stability dead-band — the line
    // now exits the wrong side of the face and crosses its sibling. It
    // should join the shareable centre (the sibling already there was the
    // indicator that 's' is the right exit).
    const hub: ShapeElement = {
      id: 'hub',
      type: 'shape',
      shape: 'square',
      x: 200,
      y: 0,
      width: 120,
      height: 120,
    };
    const left: ShapeElement = {
      id: 'left',
      type: 'shape',
      shape: 'square',
      x: 40,
      y: 260,
      width: 120,
      height: 120,
    };
    const right: ShapeElement = {
      id: 'right',
      type: 'shape',
      shape: 'square',
      x: 360,
      y: 260,
      width: 120,
      height: 120,
    };
    const arrLeft: ArrowElement = {
      id: 'arr-left',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'hub', anchor: 's' },
      to: { kind: 'pinned', elementId: 'left', anchor: 'n' },
    };
    const arrRight: ArrowElement = {
      id: 'arr-right',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'hub', anchor: 'sw' },
      to: { kind: 'pinned', elementId: 'right', anchor: 'n' },
    };
    const els: Element[] = [hub, left, right, arrLeft, arrRight];
    const out = rebindArrowAnchorsAfterMove(els, new Set(['right']));
    const next = out.find((e) => e.id === 'arr-right') as ArrowElement;
    expect(next.from.kind === 'pinned' && next.from.anchor).toBe('s');
    expect(next.to.kind === 'pinned' && next.to.anchor).toBe('n');
  });

  it('flips both anchors when b moves above a (now a vertical arrow)', () => {
    // b at (90, -300) puts it directly above a, so a should point
    // north and b should point south.
    const els: Element[] = [a(), b({ x: 90, y: -300 }), arrow()];
    const out = rebindArrowAnchorsAfterMove(els, new Set(['b']));
    const next = out[2] as ArrowElement;
    expect(next.from.kind === 'pinned' && next.from.anchor).toBe('n');
    expect(next.to.kind === 'pinned' && next.to.anchor).toBe('s');
  });

  it('leaves a both-ends-moving arrow untouched (frame / group move translates it rigidly)', () => {
    // Moving BOTH a and b together (a frame section or group drag) — even
    // into a layout where the faces would otherwise flip — must not
    // re-anchor: the arrow translated rigidly with its endpoints, so its
    // relative geometry is unchanged and the faces should stay put.
    const els: Element[] = [a(), b({ x: 90, y: -300 }), arrow()];
    const out = rebindArrowAnchorsAfterMove(els, new Set(['a', 'b']));
    expect(out[2]).toEqual(els[2]);
  });

  it('leaves a manual endpoint fixed and only re-anchors the auto end', () => {
    // b moves above a, which would normally flip the arrow to n (from) /
    // s (to). With `from` marked manual, its face must stay 'e'; only the
    // auto `to` end re-anchors.
    const manualFrom: ArrowElement = {
      id: 'arr',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'a', anchor: 'e', manual: true },
      to: { kind: 'pinned', elementId: 'b', anchor: 'w' },
    };
    const els: Element[] = [a(), b({ x: 90, y: -300 }), manualFrom];
    const out = rebindArrowAnchorsAfterMove(els, new Set(['b']));
    const next = out[2] as ArrowElement;
    expect(next.from.kind === 'pinned' && next.from.anchor).toBe('e');
    expect(next.from.kind === 'pinned' && next.from.manual).toBe(true);
    expect(next.to.kind === 'pinned' && next.to.anchor).toBe('s');
  });

  it('leaves an arrow untouched when both ends are manual', () => {
    const bothManual: ArrowElement = {
      id: 'arr',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'a', anchor: 'e', manual: true },
      to: { kind: 'pinned', elementId: 'b', anchor: 'w', manual: true },
    };
    const els: Element[] = [a(), b({ x: 90, y: -300 }), bothManual];
    const out = rebindArrowAnchorsAfterMove(els, new Set(['b']));
    expect(out[2]).toEqual(bothManual);
  });

  it('leaves arrows with a free endpoint untouched (only the pinned end would change, which jitters under drag)', () => {
    const mixed: ArrowElement = {
      id: 'arr2',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
      to: { kind: 'free', x: 400, y: 400 },
    };
    const els: Element[] = [a(), mixed];
    const out = rebindArrowAnchorsAfterMove(els, new Set(['a']));
    expect(out[1]).toEqual(mixed);
  });

  it('accepts a Map as movingIds so callers can pass startBounds directly', () => {
    // useEditorDrag's drag.startBounds is a Map<id, ShapeBounds>;
    // the helper supports Map natively so the call site doesn't
    // have to materialise a fresh Set.
    const movingIds = new Map([['b', { x: 0, y: 0, width: 1, height: 1 }]]);
    const els: Element[] = [a(), b({ x: 90, y: -300 }), arrow()];
    const out = rebindArrowAnchorsAfterMove(els, movingIds);
    const next = out[2] as ArrowElement;
    expect(next.from.kind === 'pinned' && next.from.anchor).toBe('n');
  });

  it('preserves elementId + kind when re-anchoring (only `anchor` changes)', () => {
    const els: Element[] = [a(), b({ x: 90, y: -300 }), arrow()];
    const out = rebindArrowAnchorsAfterMove(els, new Set(['b']));
    const next = out[2] as ArrowElement;
    expect(next.from.kind === 'pinned' && next.from.elementId).toBe('a');
    expect(next.to.kind === 'pinned' && next.to.elementId).toBe('b');
  });

  it('lets two DIVERGING arrows share a contested face (a tree fans, not hops)', () => {
    // The reported tree scenario: a hub with two targets below-left and
    // below-right. Both ends prefer the hub's south face, and their lines
    // diverge widely — bumping one to a perpendicular face (the old
    // behaviour) made it exit sideways and read wrong. They now SHARE
    // south and fan out.
    const hub: ShapeElement = {
      id: 'hub',
      type: 'shape',
      shape: 'square',
      x: -50,
      y: -50,
      width: 100,
      height: 100,
    };
    const dl: ShapeElement = { ...hub, id: 'dl', x: -320, y: 260, width: 40, height: 40 };
    const dr: ShapeElement = { ...hub, id: 'dr', x: 280, y: 260, width: 40, height: 40 };
    const arr1: ArrowElement = {
      id: 'arr1',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'hub', anchor: 's' },
      to: { kind: 'pinned', elementId: 'dl', anchor: 'n' },
    };
    const arr2: ArrowElement = {
      id: 'arr2',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'hub', anchor: 's' },
      to: { kind: 'pinned', elementId: 'dr', anchor: 'n' },
    };
    const out = rebindArrowAnchorsAfterMove([hub, dl, dr, arr1, arr2], new Set(['hub']));
    const a1 = out[3] as ArrowElement;
    const a2 = out[4] as ArrowElement;
    expect(a1.from.kind === 'pinned' && a1.from.anchor).toBe('s');
    expect(a2.from.kind === 'pinned' && a2.from.anchor).toBe('s');
  });

  it('keeps a whole tree fan on the hub bottom, heads into the children TOPS', () => {
    // The reported org-tree scenario: a hub with five children in a row
    // below. The wide children's lines naturally rank the hub's SIDE faces
    // and their own side faces first (the slab-ray grazes them), which
    // scattered the fan sideways. The sibling vote keeps every exit on the
    // hub's bottom edge (s, or its corners for near-parallel neighbours)
    // and the pairing pass points every head into the child's TOP.
    const hub: ShapeElement = {
      id: 'hub',
      type: 'shape',
      shape: 'square',
      x: -50,
      y: -50,
      width: 100,
      height: 100,
    };
    const xs = [-450, -250, -50, 150, 350];
    const children: ShapeElement[] = xs.map((x, i) => ({ ...hub, id: `c${i}`, x, y: 170 }));
    const arrows: ArrowElement[] = children.map((c, i) => ({
      id: `arr${i}`,
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'hub', anchor: 's' },
      to: { kind: 'pinned', elementId: c.id, anchor: 'n' },
    }));
    const out = rebindArrowAnchorsAfterMove([hub, ...children, ...arrows], new Set(['hub']));
    for (let i = 0; i < arrows.length; i++) {
      const next = out.find((e) => e.id === `arr${i}`) as ArrowElement;
      const fromAnchor = next.from.kind === 'pinned' ? next.from.anchor : '?';
      const toAnchor = next.to.kind === 'pinned' ? next.to.anchor : '?';
      // Every exit stays on the hub's bottom edge...
      expect(['s', 'se', 'sw']).toContain(fromAnchor);
      // ...and every head enters its child's top.
      expect(toAnchor).toBe('n');
    }
  });

  it("separates genuinely PARALLEL arrows to the same face's corner, not a side face", () => {
    // Two targets almost straight below (near-parallel lines): sharing
    // south would stack them, so the second slides to the south CORNER on
    // its side (se) — still leaving through the bottom edge — instead of
    // hopping to east/west.
    const hub: ShapeElement = {
      id: 'hub',
      type: 'shape',
      shape: 'square',
      x: -50,
      y: -50,
      width: 100,
      height: 100,
    };
    const d1: ShapeElement = { ...hub, id: 'd1', x: -40, y: 360, width: 40, height: 40 };
    const d2: ShapeElement = { ...hub, id: 'd2', x: 20, y: 360, width: 40, height: 40 };
    const arr1: ArrowElement = {
      id: 'arr1',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'hub', anchor: 's' },
      to: { kind: 'pinned', elementId: 'd1', anchor: 'n' },
    };
    const arr2: ArrowElement = {
      id: 'arr2',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'hub', anchor: 's' },
      to: { kind: 'pinned', elementId: 'd2', anchor: 'n' },
    };
    const out = rebindArrowAnchorsAfterMove([hub, d1, d2, arr1, arr2], new Set(['hub']));
    const anchors = [out[3], out[4]].map(
      (el) =>
        (el as ArrowElement).from.kind === 'pinned' &&
        ((el as ArrowElement).from as { anchor: string }).anchor,
    );
    // One keeps the face, the other takes a same-face corner; neither
    // lands on a perpendicular side.
    expect(anchors).toContain('s');
    expect(anchors.some((a) => a === 'se' || a === 'sw')).toBe(true);
    expect(anchors).not.toContain('e');
    expect(anchors).not.toContain('w');
  });

  it('routes a moved arrow around a face already held by an untouched arrow', () => {
    // c sits due east of a, so a's arrow to c wants a's east face — but a
    // static arrow already pins a's east face, so the re-pinned one takes a
    // free face instead of stacking.
    const c: ShapeElement = {
      id: 'c',
      type: 'shape',
      shape: 'square',
      x: 300,
      y: 0,
      width: 100,
      height: 80,
    };
    const staticArrow: ArrowElement = {
      id: 'static',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
      to: { kind: 'free', x: 600, y: 40 },
    };
    const moving: ArrowElement = {
      id: 'moving',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'a', anchor: 'n' },
      to: { kind: 'pinned', elementId: 'c', anchor: 'w' },
    };
    const out = rebindArrowAnchorsAfterMove([a(), c, staticArrow, moving], new Set(['a']));
    const next = out[3] as ArrowElement;
    expect(next.from.kind === 'pinned' && next.from.anchor).not.toBe('e');
  });
});

describe('layer order', () => {
  const ids = (els: Element[]) => els.map((e) => e.id);

  it('bringToFront moves the element to the end (top)', () => {
    const list = [shape('a'), shape('b'), shape('c')];
    expect(ids(bringToFront(list, 'a'))).toEqual(['b', 'c', 'a']);
  });

  it('sendToBack moves the element to the start (bottom)', () => {
    const list = [shape('a'), shape('b'), shape('c')];
    expect(ids(sendToBack(list, 'c'))).toEqual(['c', 'a', 'b']);
  });

  it('bringToFront / sendToBack are no-ops for a missing id', () => {
    const list = [shape('a'), shape('b')];
    expect(bringToFront(list, 'x')).toBe(list);
    expect(sendToBack(list, 'x')).toBe(list);
  });

  it('bringManyToFront keeps members after non-members, preserving order', () => {
    const list = [shape('a'), shape('b'), shape('c'), shape('d')];
    expect(ids(bringManyToFront(list, new Set(['a', 'c'])))).toEqual(['b', 'd', 'a', 'c']);
  });

  it('sendManyToBack keeps members before non-members, preserving order', () => {
    const list = [shape('a'), shape('b'), shape('c'), shape('d')];
    expect(ids(sendManyToBack(list, new Set(['b', 'd'])))).toEqual(['b', 'd', 'a', 'c']);
  });
});

describe('type predicates', () => {
  const arrow: ArrowElement = {
    id: 'e',
    type: 'arrow',
    from: { kind: 'free', x: 0, y: 0 },
    to: { kind: 'free', x: 1, y: 1 },
  };

  // The three element-classification predicates feed dozens of
  // sites (resize handles, paint setters, paletteSelection field
  // gates, marquee inclusion, elementBounds). A regression that
  // misses a new BoxedElement variant tends to surface in
  // confusing ways: a fresh element renders, but its setters
  // no-op, or its bounds compute as zero, or marquee skips it.
  // Cover the full kind matrix here so the next variant has to
  // land in every predicate (or fail loudly) on the way in.

  it('isBoxed is true for every boxed-element kind, false for arrow', () => {
    expect(isBoxed(shape('a'))).toBe(true);
    expect(isBoxed({ ...shape('b'), type: 'text' } as Element)).toBe(true);
    expect(isBoxed({ ...shape('c'), type: 'sticky' } as Element)).toBe(true);
    expect(isBoxed({ ...shape('d'), type: 'image', imageId: null } as Element)).toBe(true);
    // freehand: structurally a boxed element + a normalised polyline.
    // The runtime guard must match the type-union membership; a recent
    // bug left it false here and crashed elementBounds on commit.
    expect(isBoxed({ ...shape('e'), type: 'freehand', points: [], closed: false } as Element)).toBe(
      true,
    );
    expect(isBoxed(arrow)).toBe(false);
  });

  it('supportsColours covers shape, sticky, arrow, freehand; not text or image', () => {
    expect(supportsColours(shape('a'))).toBe(true);
    expect(supportsColours({ ...shape('b'), type: 'sticky' } as Element)).toBe(true);
    expect(supportsColours(arrow)).toBe(true);
    expect(
      supportsColours({
        ...shape('c'),
        type: 'freehand',
        points: [],
        closed: false,
      } as Element),
    ).toBe(true);
    // Text + image elements don't show the Colours accordion's
    // fill / stroke swatches; the negative cases stop a future
    // refactor that "simplifies" the predicate to `isBoxed || arrow`
    // and silently changes the surfaced fields.
    expect(supportsColours({ ...shape('d'), type: 'text' } as Element)).toBe(false);
    expect(supportsColours({ ...shape('e'), type: 'image', imageId: null } as Element)).toBe(false);
  });

  it('supportsBorder is true for shape and freehand only', () => {
    // Border-stroke + border-pattern apply to shapes and the pen
    // tool's freehand element (both render through the same
    // strokeWidth / strokeStyle fields). Everything else (text,
    // sticky, image, arrow) lights up its own controls elsewhere
    // and must NOT receive a BorderStroke / BorderStyle write.
    expect(supportsBorder(shape('a'))).toBe(true);
    expect(
      supportsBorder({
        ...shape('b'),
        type: 'freehand',
        points: [],
        closed: false,
      } as Element),
    ).toBe(true);
    expect(supportsBorder({ ...shape('c'), type: 'sticky' } as Element)).toBe(false);
    expect(supportsBorder({ ...shape('d'), type: 'text' } as Element)).toBe(false);
    expect(supportsBorder({ ...shape('e'), type: 'image', imageId: null } as Element)).toBe(false);
    expect(supportsBorder(arrow)).toBe(false);
  });
});
