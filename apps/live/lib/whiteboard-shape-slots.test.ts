import { describe, expect, it } from 'vitest';
import {
  dropIndicatorX,
  frequentShapes,
  pinFromMenu,
  recordShapePick,
  resolveSlotDrop,
  SHAPE_PICKS_KEPT,
  slotDropTarget,
  unpinShape,
  type ShapePicks,
} from './whiteboard-shape-slots';
import type { WhiteboardShapeKey } from './whiteboard-shape-catalogue';

describe('frequentShapes', () => {
  it('falls back to Rectangle then Ellipse with no history', () => {
    expect(frequentShapes({}, [])).toEqual(['rectangle', 'ellipse']);
  });

  it('ranks by how often a kind was picked', () => {
    const picks: ShapePicks = { triangle: [5, 10], star: [9, 5], rectangle: [2, 99] };
    expect(frequentShapes(picks, [])).toEqual(['star', 'triangle']);
  });

  it('breaks a tie in favour of the kind picked most recently', () => {
    const picks: ShapePicks = { triangle: [3, 10], star: [3, 20] };
    expect(frequentShapes(picks, [])).toEqual(['star', 'triangle']);
  });

  it('leaves out kinds already pinned, and fills from the fallbacks without repeating', () => {
    expect(frequentShapes({ star: [4, 1] }, ['rectangle'])).toEqual(['star', 'ellipse']);
    expect(frequentShapes({}, ['rectangle', 'ellipse'])).toEqual(['diamond', 'cylinder']);
    expect(frequentShapes({ ellipse: [1, 1] }, [])).toEqual(['ellipse', 'rectangle']);
  });

  it('ignores kinds the catalogue does not know', () => {
    expect(frequentShapes({ banner: [50, 1] }, [])).toEqual(['rectangle', 'ellipse']);
  });
});

describe('recordShapePick', () => {
  it('counts a pick and stamps when', () => {
    const once = recordShapePick({}, 'star', 100);
    expect(once).toEqual({ star: [1, 100] });
    expect(recordShapePick(once, 'star', 200)).toEqual({ star: [2, 200] });
  });

  it('keeps a bounded history, dropping the weakest other kind, never the one just picked', () => {
    let picks: ShapePicks = {};
    const keys: WhiteboardShapeKey[] = [
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
    ];
    keys.forEach((k, i) => {
      picks = recordShapePick(picks, k, i);
      picks = recordShapePick(picks, k, i);
    });
    expect(Object.keys(picks)).toHaveLength(SHAPE_PICKS_KEPT);
    const next = recordShapePick(picks, 'trapezoid', 100);
    expect(Object.keys(next)).toHaveLength(SHAPE_PICKS_KEPT);
    expect(next.trapezoid).toEqual([1, 100]);
    expect(next.rectangle).toBeUndefined();
  });
});

describe('slotDropTarget', () => {
  // Two pinned slots at 0..44 and 46..90, the separator at 100.
  const layout = {
    separatorX: 100,
    pinned: [
      { key: 'star' as const, left: 0, right: 44 },
      { key: 'cloud' as const, left: 46, right: 90 },
    ],
  };

  it('reads right of the separator as the frequent side', () => {
    expect(slotDropTarget(150, layout)).toEqual({ zone: 'frequent' });
  });

  it('reads a pointer over a pinned slot as onto that slot', () => {
    expect(slotDropTarget(20, layout)).toEqual({ zone: 'pinned', onto: 'star', index: 0 });
    expect(slotDropTarget(60, layout)).toEqual({ zone: 'pinned', onto: 'cloud', index: 1 });
  });

  it('reads the gap left of the separator as an insertion point', () => {
    expect(slotDropTarget(95, layout)).toEqual({ zone: 'pinned', index: 2 });
    expect(slotDropTarget(-10, layout)).toEqual({ zone: 'pinned', index: 0 });
  });
});

describe('resolveSlotDrop', () => {
  it('pins a frequent kind where it is dropped', () => {
    expect(
      resolveSlotDrop(['star'], { key: 'cloud', from: 'frequent' }, { zone: 'pinned', index: 0 }),
    ).toEqual({ type: 'pin', pinned: ['cloud', 'star'] });
    expect(
      resolveSlotDrop([], { key: 'cloud', from: 'frequent' }, { zone: 'pinned', index: 0 }),
    ).toEqual({ type: 'pin', pinned: ['cloud'] });
  });

  it('replaces a pinned kind it is dropped onto when two are pinned', () => {
    expect(
      resolveSlotDrop(
        ['star', 'cloud'],
        { key: 'hexagon', from: 'frequent' },
        { zone: 'pinned', onto: 'cloud', index: 1 },
      ),
    ).toEqual({ type: 'pin', pinned: ['star', 'hexagon'] });
  });

  it('refuses a third pin dropped anywhere else', () => {
    expect(
      resolveSlotDrop(
        ['star', 'cloud'],
        { key: 'hexagon', from: 'frequent' },
        { zone: 'pinned', index: 2 },
      ),
    ).toEqual({ type: 'refused' });
  });

  it('unpins a pinned kind dragged right of the separator', () => {
    expect(
      resolveSlotDrop(['star', 'cloud'], { key: 'star', from: 'pinned' }, { zone: 'frequent' }),
    ).toEqual({ type: 'unpin', pinned: ['cloud'] });
  });

  it('reorders the pinned kinds among themselves', () => {
    expect(
      resolveSlotDrop(
        ['star', 'cloud'],
        { key: 'star', from: 'pinned' },
        { zone: 'pinned', onto: 'cloud', index: 1 },
      ),
    ).toEqual({ type: 'pin', pinned: ['cloud', 'star'] });
    expect(
      resolveSlotDrop(
        ['star', 'cloud'],
        { key: 'cloud', from: 'pinned' },
        { zone: 'pinned', index: 0 },
      ),
    ).toEqual({ type: 'pin', pinned: ['cloud', 'star'] });
  });

  it('does nothing for a frequent slot dropped back on its own side, or a pinned one left in place', () => {
    expect(resolveSlotDrop([], { key: 'star', from: 'frequent' }, { zone: 'frequent' })).toEqual({
      type: 'none',
    });
    expect(
      resolveSlotDrop(
        ['star', 'cloud'],
        { key: 'star', from: 'pinned' },
        { zone: 'pinned', onto: 'star', index: 0 },
      ),
    ).toEqual({ type: 'none' });
  });
});

describe('pinning without a drag', () => {
  it('pins at the end while there is room, and refuses a third', () => {
    expect(pinFromMenu([], 'star')).toEqual({ type: 'pin', pinned: ['star'] });
    expect(pinFromMenu(['star'], 'cloud')).toEqual({ type: 'pin', pinned: ['star', 'cloud'] });
    expect(pinFromMenu(['star', 'cloud'], 'hexagon')).toEqual({ type: 'refused' });
  });

  it('unpins', () => {
    expect(unpinShape(['star', 'cloud'], 'star')).toEqual({ type: 'unpin', pinned: ['cloud'] });
  });
});

describe('dropIndicatorX', () => {
  const layout = {
    separatorX: 100,
    pinned: [{ key: 'star' as const, left: 0, right: 44 }],
  };
  const frequent = { key: 'cloud' as const, from: 'frequent' as const };

  it('marks the insertion point on the pinned side', () => {
    expect(dropIndicatorX(layout, frequent, { zone: 'pinned', index: 0 })).toBe(-2);
    expect(dropIndicatorX(layout, frequent, { zone: 'pinned', index: 1 })).toBe(46);
    expect(
      dropIndicatorX({ separatorX: 100, pinned: [] }, frequent, { zone: 'pinned', index: 0 }),
    ).toBe(96);
  });

  it('rings a pinned slot rather than drawing a bar when dropping onto it', () => {
    expect(dropIndicatorX(layout, frequent, { zone: 'pinned', index: 0, onto: 'star' })).toBeNull();
  });

  it('marks the frequent side only for a pinned kind being dragged out', () => {
    expect(dropIndicatorX(layout, frequent, { zone: 'frequent' })).toBeNull();
    expect(dropIndicatorX(layout, { key: 'star', from: 'pinned' }, { zone: 'frequent' })).toBe(104);
  });
});
