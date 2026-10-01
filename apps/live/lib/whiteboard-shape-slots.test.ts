import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PINNED_SHAPES,
  dropIndicatorX,
  PINNED_SHAPES_MAX,
  pinFromMenu,
  recordShapePick,
  resolveSlotDrop,
  SHAPE_PICKS_KEPT,
  shapeSlots,
  slotDropTarget,
  unpinShape,
  type ShapePicks,
  type SlotLayout,
} from './whiteboard-shape-slots';
import type { WhiteboardShapeKey } from './whiteboard-shape-catalogue';

// Seven pinned: the limit.
const FULL: WhiteboardShapeKey[] = [
  'star',
  'cloud',
  'hexagon',
  'triangle',
  'document',
  'stadium',
  'trapezoid',
];

describe('the pinned side', () => {
  it('holds Arrow and Rectangle by default, of at most seven', () => {
    expect(DEFAULT_PINNED_SHAPES).toEqual(['arrow', 'rectangle']);
    expect(PINNED_SHAPES_MAX).toBe(7);
  });
});

describe('shapeSlots', () => {
  it('falls back down the Shapes flyout order past the default pins', () => {
    expect(shapeSlots({}, DEFAULT_PINNED_SHAPES)).toEqual({
      mostUsed: ['ellipse', 'diamond', 'cylinder'],
      recent: ['line', 'parallelogram', 'hexagon'],
    });
  });

  it('puts the most picked kinds first, then the most recent others, newest first', () => {
    const picks: ShapePicks = {
      star: [9, 1],
      cloud: [1, 5],
      hexagon: [2, 7],
      triangle: [1, 3],
      stadium: [4, 2],
      trapezoid: [1, 9],
      document: [1, 4],
    };
    expect(shapeSlots(picks, [])).toEqual({
      mostUsed: ['star', 'stadium', 'hexagon'],
      recent: ['trapezoid', 'cloud', 'document'],
    });
  });

  it('breaks a most-used tie in favour of the kind picked most recently', () => {
    const picks: ShapePicks = { star: [3, 10], cloud: [3, 20] };
    expect(shapeSlots(picks, []).mostUsed.slice(0, 2)).toEqual(['cloud', 'star']);
  });

  it('leaves pinned kinds out of every slot, and never shows a kind twice', () => {
    const picks: ShapePicks = { arrow: [9, 9], star: [2, 1], cloud: [1, 8] };
    const { mostUsed, recent } = shapeSlots(picks, DEFAULT_PINNED_SHAPES);
    expect(mostUsed).toEqual(['star', 'cloud', 'ellipse']);
    expect(recent).toEqual(['diamond', 'cylinder', 'line']);
    const all = [...DEFAULT_PINNED_SHAPES, ...mostUsed, ...recent];
    expect(new Set(all).size).toBe(all.length);
  });

  it('shows an unpinned kind at once when its picks rank it', () => {
    const picks: ShapePicks = { rectangle: [3, 1], star: [1, 2] };
    expect(shapeSlots(picks, DEFAULT_PINNED_SHAPES).mostUsed[0]).toBe('star');
    expect(shapeSlots(picks, ['arrow', 'ellipse']).mostUsed[0]).toBe('rectangle');
  });

  it('ignores kinds the catalogue does not know', () => {
    expect(shapeSlots({ banner: [50, 1] }, []).mostUsed).toEqual([
      'rectangle',
      'ellipse',
      'diamond',
    ]);
  });
});

describe('recordShapePick', () => {
  it('counts a pick and stamps when', () => {
    const once = recordShapePick({}, 'star', 100);
    expect(once).toEqual({ star: [1, 100] });
    expect(recordShapePick(once, 'star', 200)).toEqual({ star: [2, 200] });
  });

  it('keeps a bounded record, dropping the least recent kind that is not among the most picked', () => {
    let picks: ShapePicks = {};
    const catalogue: WhiteboardShapeKey[] = [
      'rectangle',
      'ellipse',
      'diamond',
      'cylinder',
      'line',
      'arrow',
      'triangle',
      'star',
      'hexagon',
      'cloud',
      'document',
      'stadium',
      'trapezoid',
      'parallelogram',
      'speech-bubble',
      'page',
      'mind-node',
      'lane',
      'frame',
      'timeline-rail',
    ];
    // Rectangle is picked often but long ago; the rest once each, later.
    for (let i = 0; i < 5; i++) picks = recordShapePick(picks, 'rectangle', i);
    catalogue.slice(1).forEach((k, i) => {
      picks = recordShapePick(picks, k, 10 + i);
    });
    expect(Object.keys(picks)).toHaveLength(SHAPE_PICKS_KEPT);
    const next = recordShapePick(picks, 'browser', 100);
    expect(Object.keys(next)).toHaveLength(SHAPE_PICKS_KEPT);
    expect(next.browser).toEqual([1, 100]);
    // The heavy hitter survives; the least recent single pick goes.
    expect(next.rectangle).toEqual([5, 4]);
    expect(next.ellipse).toBeUndefined();
  });
});

describe('slotDropTarget', () => {
  // Two pinned slots at 0..44 and 46..90; the separator at 93. The bar spans 0..150, 0..44 high.
  const layout: SlotLayout = {
    boundaryX: 93,
    bar: { left: 0, right: 150, top: 0, bottom: 44 },
    pinned: [
      { key: 'star', left: 0, right: 44 },
      { key: 'cloud', left: 46, right: 90 },
    ],
  };

  it('reads past the separator as past the pinned side', () => {
    expect(slotDropTarget(120, 20, layout)).toEqual({ zone: 'past' });
  });

  it('reads a pointer well off the bar as off it (the flyout above included)', () => {
    expect(slotDropTarget(20, -120, layout)).toEqual({ zone: 'off' });
    expect(slotDropTarget(-200, 20, layout)).toEqual({ zone: 'off' });
  });

  it('reads a pointer over a pinned slot as onto it, before or after it by which half', () => {
    expect(slotDropTarget(20, 20, layout)).toEqual({ zone: 'pinned', onto: 'star', index: 0 });
    expect(slotDropTarget(30, 20, layout)).toEqual({ zone: 'pinned', onto: 'star', index: 1 });
    expect(slotDropTarget(60, 20, layout)).toEqual({ zone: 'pinned', onto: 'cloud', index: 1 });
    expect(slotDropTarget(80, 20, layout)).toEqual({ zone: 'pinned', onto: 'cloud', index: 2 });
  });

  it('reads the reach just left of the bar as the start of the pinned side', () => {
    expect(slotDropTarget(-10, 20, layout)).toEqual({ zone: 'pinned', index: 0 });
  });

  it('gives an empty pinned side the room before the separator', () => {
    const empty: SlotLayout = { ...layout, boundaryX: 6, pinned: [] };
    expect(slotDropTarget(-20, 20, empty)).toEqual({ zone: 'pinned', index: 0 });
    expect(slotDropTarget(20, 20, empty)).toEqual({ zone: 'past' });
  });
});

describe('resolveSlotDrop', () => {
  it('pins a flyout shape where it is dropped', () => {
    expect(
      resolveSlotDrop(['star'], { key: 'cloud', from: 'flyout' }, { zone: 'pinned', index: 0 }),
    ).toEqual({ type: 'pin', pinned: ['cloud', 'star'] });
    expect(
      resolveSlotDrop([], { key: 'cloud', from: 'flyout' }, { zone: 'pinned', index: 0 }),
    ).toEqual({ type: 'pin', pinned: ['cloud'] });
  });

  it('pins beside the slot it is dropped on while there is room, never replacing it', () => {
    expect(
      resolveSlotDrop(
        ['star', 'cloud'],
        { key: 'hexagon', from: 'flyout' },
        { zone: 'pinned', onto: 'cloud', index: 2 },
      ),
    ).toEqual({ type: 'pin', pinned: ['star', 'cloud', 'hexagon'] });
  });

  it('replaces a pinned kind it is dropped onto when seven are pinned', () => {
    expect(
      resolveSlotDrop(
        FULL,
        { key: 'rectangle', from: 'flyout' },
        { zone: 'pinned', onto: 'cloud', index: 1 },
      ),
    ).toEqual({
      type: 'pin',
      pinned: ['star', 'rectangle', 'hexagon', 'triangle', 'document', 'stadium', 'trapezoid'],
    });
  });

  it('refuses an eighth pin dropped anywhere else on the pinned side', () => {
    expect(
      resolveSlotDrop(FULL, { key: 'rectangle', from: 'flyout' }, { zone: 'pinned', index: 2 }),
    ).toEqual({ type: 'refused' });
  });

  it('unpins a pinned kind dragged past the separator or off the bar', () => {
    expect(
      resolveSlotDrop(['star', 'cloud'], { key: 'star', from: 'pinned' }, { zone: 'past' }),
    ).toEqual({ type: 'unpin', pinned: ['cloud'] });
    expect(resolveSlotDrop(['star'], { key: 'star', from: 'pinned' }, { zone: 'off' })).toEqual({
      type: 'unpin',
      pinned: [],
    });
  });

  it('does nothing for a flyout shape dropped past the separator or off the bar', () => {
    expect(resolveSlotDrop([], { key: 'star', from: 'flyout' }, { zone: 'past' })).toEqual({
      type: 'none',
    });
    expect(resolveSlotDrop([], { key: 'star', from: 'flyout' }, { zone: 'off' })).toEqual({
      type: 'none',
    });
  });

  it('reorders the pinned kinds among themselves, by insertion point', () => {
    expect(
      resolveSlotDrop(
        ['star', 'cloud'],
        { key: 'star', from: 'pinned' },
        { zone: 'pinned', onto: 'cloud', index: 2 },
      ),
    ).toEqual({ type: 'pin', pinned: ['cloud', 'star'] });
    expect(
      resolveSlotDrop(
        ['star', 'cloud'],
        { key: 'star', from: 'pinned' },
        { zone: 'pinned', onto: 'cloud', index: 1 },
      ),
    ).toEqual({ type: 'none' });
    expect(
      resolveSlotDrop(FULL, { key: 'document', from: 'pinned' }, { zone: 'pinned', index: 0 }),
    ).toEqual({
      type: 'pin',
      pinned: ['document', 'star', 'cloud', 'hexagon', 'triangle', 'stadium', 'trapezoid'],
    });
  });
});

describe('pinning without a drag', () => {
  it('pins at the end while there is room, and refuses an eighth', () => {
    expect(pinFromMenu([], 'star')).toEqual({ type: 'pin', pinned: ['star'] });
    expect(pinFromMenu(['star'], 'cloud')).toEqual({ type: 'pin', pinned: ['star', 'cloud'] });
    expect(pinFromMenu(FULL, 'rectangle')).toEqual({ type: 'refused' });
  });

  it('unpins', () => {
    expect(unpinShape(['star', 'cloud'], 'star')).toEqual({ type: 'unpin', pinned: ['cloud'] });
  });
});

describe('dropIndicatorX', () => {
  const layout: SlotLayout = {
    boundaryX: 91,
    bar: { left: 0, right: 300, top: 0, bottom: 44 },
    pinned: [{ key: 'star', left: 0, right: 44 }],
  };
  const slot = { key: 'cloud' as const, from: 'flyout' as const };

  it('marks the insertion point on the pinned side', () => {
    expect(dropIndicatorX(layout, slot, { zone: 'pinned', index: 0 })).toBe(-2);
    expect(dropIndicatorX(layout, slot, { zone: 'pinned', index: 1 })).toBe(46);
    const empty: SlotLayout = { ...layout, boundaryX: 4, pinned: [] };
    expect(dropIndicatorX(empty, slot, { zone: 'pinned', index: 0 })).toBe(2);
  });

  it('rings a pinned slot rather than drawing a bar when a full side would replace it', () => {
    const full: SlotLayout = {
      ...layout,
      boundaryX: 400,
      pinned: FULL.map((key, i) => ({ key, left: i * 46, right: i * 46 + 44 })),
    };
    expect(dropIndicatorX(full, slot, { zone: 'pinned', index: 0, onto: 'star' })).toBeNull();
    expect(
      dropIndicatorX(
        full,
        { key: 'cloud', from: 'pinned' },
        { zone: 'pinned', index: 0, onto: 'star' },
      ),
    ).toBe(-2);
  });

  it('marks the separator for a pinned kind leaving past it, and nothing off the bar', () => {
    expect(dropIndicatorX(layout, { key: 'star', from: 'pinned' }, { zone: 'past' })).toBe(91);
    expect(dropIndicatorX(layout, slot, { zone: 'past' })).toBeNull();
    expect(dropIndicatorX(layout, { key: 'star', from: 'pinned' }, { zone: 'off' })).toBeNull();
  });
});
