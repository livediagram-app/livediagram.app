import { describe, expect, it } from 'vitest';
import type { Element } from '@livehuddle/document';
import { boxesOverlap, bubbleAbove, BUBBLE_PIECES } from '@livehuddle/avatar/piece-bubble';
import { buildTemplate } from './build-template';
import { templateFloors } from './template-floors';
import { TEMPLATES } from './templates';

// The proximity bubbles (docs/specs/009-elements/social-pieces.md "Arcade Machine", workday-pieces.md "Reception
// Desk"): standing at an Arcade Machine or a Reception Desk raises a bubble (Insert Coin with the machine's best,
// Welcome with Ring Bell) 6 px above the piece, centred on it. Work Tracker 615: no template stands a Room Sign (a
// room's status card) where that bubble rises, so in every template it rises above its piece. A sign placed by hand
// there flips the bubble below the piece instead (Work Tracker 793), by the same geometry (piece-bubble.ts).

type Shape = Extract<Element, { type: 'shape' }>;

const bubbleOver = bubbleAbove;
const overlaps = boxesOverlap;

// Every tab of every template: its first and each floor after it.
const tabs = TEMPLATES.flatMap((t) => [
  { name: t.title, elements: buildTemplate(t.kind, 0, 0) },
  ...templateFloors(t.kind).map((f) => ({ name: `${t.title} ${f.name}`, elements: f.build(0, 0) })),
]);
const shapesOf = (els: readonly Element[]) => els.filter((e): e is Shape => e.type === 'shape');

describe('the proximity bubbles in the templates (Work Tracker 615)', () => {
  it('never rise over a Room Sign', () => {
    const clashes = tabs.flatMap(({ name, elements }) => {
      const shapes = shapesOf(elements);
      const signs = shapes.filter((s) => s.shape === 'room-sign');
      return shapes
        .filter((p) => BUBBLE_PIECES.has(p.shape))
        .flatMap((p) =>
          signs
            .filter((s) => overlaps(bubbleOver(p), s))
            .map(
              (s) =>
                `${name}: ${p.shape} at ${p.x},${p.y} under ${s.label ?? 'sign'} at ${s.x},${s.y}`,
            ),
        );
    });
    expect(clashes).toEqual([]);
  });

  it('checks a template with each piece and a sign, so the test above has something to find', () => {
    const all = tabs.flatMap(({ elements }) => shapesOf(elements));
    expect(all.some((s) => s.shape === 'arcade-machine')).toBe(true);
    expect(all.some((s) => s.shape === 'reception-desk')).toBe(true);
    expect(all.some((s) => s.shape === 'room-sign')).toBe(true);
    // The geometry itself: a sign just above a piece is under its bubble, one beside the bubble is not.
    const piece = { x: 100, y: 100, width: 60, height: 80 };
    expect(overlaps(bubbleOver(piece), { x: 110, y: 60, width: 88, height: 47 })).toBe(true);
    expect(overlaps(bubbleOver(piece), { x: 220, y: 60, width: 88, height: 47 })).toBe(false);
  });
});
