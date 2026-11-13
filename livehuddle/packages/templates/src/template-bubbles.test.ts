import { describe, expect, it } from 'vitest';
import type { Element } from '@livehuddle/document';
import { buildTemplate } from './build-template';
import { templateFloors } from './template-floors';
import { TEMPLATES } from './templates';

// The proximity bubbles (docs/specs/009-elements/social-pieces.md "Arcade Machine", workday-pieces.md "Reception
// Desk"): standing at an Arcade Machine or a Reception Desk raises a bubble (Insert Coin with the machine's best,
// Welcome with Ring Bell) 6 px above the piece, centred on it. Work Tracker 615: no template stands a Room Sign (a
// room's status card) where that bubble rises, so the bubble never covers the card.

type Shape = Extract<Element, { type: 'shape' }>;
type Box = { x: number; y: number; width: number; height: number };

// The bubble's room, canvas px: as wide as Insert Coin with a long best line under it (its 140 px cap, padding and
// border), as tall as those two lines, lifted 6 px off the piece's top.
const BUBBLE_ROOM = { width: 160, height: 44, lift: 6 } as const;
const BUBBLE_PIECES = new Set(['arcade-machine', 'reception-desk']);

const bubbleOver = (p: Box): Box => ({
  x: p.x + p.width / 2 - BUBBLE_ROOM.width / 2,
  y: p.y - BUBBLE_ROOM.lift - BUBBLE_ROOM.height,
  width: BUBBLE_ROOM.width,
  height: BUBBLE_ROOM.height,
});
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

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
