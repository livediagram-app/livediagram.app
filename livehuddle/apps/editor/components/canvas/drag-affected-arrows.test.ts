import { describe, expect, it } from 'vitest';
import { createArrow, createPinnedArrow, createShape, type Element } from '@livediagram/document';
import { overlayBetween } from '@/lib/drag-preview';
import { affectedArrows, buildArrowLinks } from './drag-affected-arrows';

// docs/specs/008-canvas/drag-preview.md: a preview covers the dragged elements and every arrow whose
// drawing depends on them.

const box = (id: string, x: number, y = 0) => ({
  ...createShape('square', x, y),
  id,
  fillColor: '#fff',
});
const a = box('a', 0);
const b = box('b', 400);
const far = box('far', 3000, 3000);
const ab = { ...createPinnedArrow('a', 'e', 'b', 'w'), id: 'ab' };
const rider = {
  ...createArrow(0, 300, 0, 0),
  id: 'rider',
  to: { kind: 'on-arrow' as const, arrowId: 'ab', t: 0.5 },
};
const loose = { ...createArrow(200, -200, 200, 400), id: 'loose' };
const distant = { ...createArrow(5000, 5000, 5200, 5000), id: 'distant' };
const doc: Element[] = [a, b, far, ab, rider, loose, distant];

const affected = (next: Element[]) =>
  [...affectedArrows(overlayBetween('t', next, doc), doc, buildArrowLinks(doc))].sort();

describe('affectedArrows', () => {
  it('takes the arrows pinned to a moved box, and arrows riding on them', () => {
    expect(affected(doc.map((el) => (el.id === 'b' ? { ...b, y: 50 } : el)))).toEqual([
      'ab',
      'rider',
    ]);
  });

  it('takes an arrow a moved box crosses, where it was or where it went', () => {
    const into = doc.map((el) => (el.id === 'far' ? { ...far, x: 150, y: 100 } : el));
    expect(affected(into)).toContain('loose');
    expect(affected(into)).not.toContain('distant');
  });

  it('takes an arrow the gesture reshapes, and nothing for an untouched board', () => {
    expect(
      affected(doc.map((el) => (el.id === 'ab' ? { ...ab, curveOffset: { dx: 0, dy: 40 } } : el))),
    ).toEqual(['ab', 'rider']);
    expect(affected(doc)).toEqual([]);
  });
});
