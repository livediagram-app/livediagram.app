import { describe, expect, it } from 'vitest';
import { createShape, createText, isFloorShape, type Element } from '@livehuddle/document';
import { BLANK_PAD_DROP, buildTemplate, floorsFirst } from './build-template';
import { TEMPLATES } from './templates';

// docs/specs/009-elements/avatar-pad.md "Every Space and blank tab has one".
describe('Blank Space', () => {
  it('is one Avatar Pad, centred across the view and BLANK_PAD_DROP below its middle', () => {
    const els = buildTemplate('blank-session', 300, -200);
    expect(els).toHaveLength(1);
    const pad = els[0] as Element & {
      shape: string;
      x: number;
      y: number;
      width: number;
      height: number;
    };
    expect(pad.type).toBe('shape');
    expect(pad.shape).toBe('avatar-pad');
    expect(pad.x + pad.width / 2).toBe(300);
    expect(pad.y + pad.height / 2).toBe(-200 + BLANK_PAD_DROP);
  });

  it('leaves the middle of the view free, the whole pad below it', () => {
    const [pad] = buildTemplate('blank-session', 0, 0) as (Element & { y: number })[];
    expect(pad!.y).toBeGreaterThan(0);
  });
});

describe('floorsFirst', () => {
  it('puts every floor ahead of the rest, keeping each group in its order', () => {
    const text = { ...createText(0, 0), id: 't' };
    const room = { ...createShape('room', 0, 0), id: 'r' };
    const desk = { ...createShape('desk', 0, 0), id: 'd' };
    const pad = { ...createShape('avatar-pad', 0, 0), id: 'p' };
    expect(floorsFirst([text, room, desk, pad]).map((e) => e.id)).toEqual(['r', 'p', 't', 'd']);
  });

  it('lays every template’s floors first, its Avatar Pad among them', () => {
    for (const { kind } of TEMPLATES) {
      const els = buildTemplate(kind, 0, 0);
      const isFloor = (e: Element) => e.type === 'shape' && isFloorShape(e.shape);
      const firstOther = els.findIndex((e) => !isFloor(e));
      if (firstOther >= 0) expect(els.slice(firstOther).some(isFloor), kind).toBe(false);
      expect(
        els.filter((e) => e.type === 'shape' && e.shape === 'avatar-pad'),
        kind,
      ).toHaveLength(1);
    }
  });
});
