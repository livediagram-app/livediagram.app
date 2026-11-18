import { describe, expect, it } from 'vitest';
import { createShape, type Element, type ShapeElement } from '@livehuddle/document';
import { roomier, TEMPLATE_ROOMY } from './template-roomy';
import { buildTemplate } from './build-template';
import { TEMPLATES } from './templates';

// docs/specs/007-editor/templates-by-mode.md "Room to move": rooms grow, furniture keeps its size and its groups,
// wall pieces stay on (or go back to) their walls.

const at = (kind: string, x: number, y: number, more: Partial<ShapeElement> = {}): ShapeElement =>
  ({ ...createShape(kind as ShapeElement['shape'], x, y), ...more });
const room = (x: number, y: number, width: number, height: number) =>
  at('room', x, y, { width, height });
const by = (els: Element[], kind: string) =>
  els.filter((e): e is ShapeElement => e.type === 'shape' && e.shape === kind);

describe('roomier', () => {
  it('grows a room about the centre and keeps a piece its size', () => {
    const els = [room(0, 0, 400, 300), at('plant', 180, 140)];
    const [r, plant] = roomier(els, 0, 0) as ShapeElement[];
    expect([r!.width, r!.height]).toEqual([400 * TEMPLATE_ROOMY, 300 * TEMPLATE_ROOMY]);
    expect(plant!.width).toBe(els[1]!.type === 'shape' ? (els[1] as ShapeElement).width : 0);
  });

  it('moves a chair with the desk it stands at', () => {
    const desk = at('desk', 200, 150);
    const chair = at('chair', 200, 150 + desk.height + 4);
    const [, d, c] = roomier([room(0, 0, 600, 500), desk, chair], 0, 0) as ShapeElement[];
    expect(c!.x - d!.x).toBe(chair.x - desk.x);
    expect(c!.y - d!.y).toBe(chair.y - desk.y);
  });

  it('keeps a piece by a wall that far from it', () => {
    const plant = at('plant', 20, 200);
    const [r, p] = roomier([room(0, 0, 600, 500), plant], 0, 0) as ShapeElement[];
    expect(p!.x - r!.x).toBe(20);
  });

  it('pushes a bookshelf standing out in the floor back against its nearest wall', () => {
    const shelf = at('bookshelf', 200, 36 + 100);
    const [r, s] = roomier([room(0, 0, 800, 600), shelf], 0, 0) as ShapeElement[];
    expect(s!.y - (r!.y + 36)).toBeLessThanOrEqual(2);
  });

  it('leaves a plan with no rooms as drawn', () => {
    const els = [at('avatar-pad', 10, 10)];
    expect(roomier(els, 0, 0)).toBe(els);
  });

  it('keeps a Room Sign by its Door', () => {
    const door = at('door', 250, 488);
    const sign = at('room-sign', 360, 520);
    const out = roomier([room(0, 0, 600, 500), door, sign], 0, 0) as ShapeElement[];
    expect(out[2]!.x - out[1]!.x).toBe(sign.x - door.x);
    expect(out[2]!.y - out[1]!.y).toBe(sign.y - door.y);
  });
});

describe('every Space opened out', () => {
  it('gives each room at least a quarter more floor than its pieces take', () => {
    for (const t of TEMPLATES) {
      const els = buildTemplate(t.kind, 0, 0);
      for (const r of by(els, 'room')) {
        const pieces = els.filter(
          (e): e is ShapeElement =>
            e.type === 'shape' &&
            !['room', 'door', 'window', 'rug', 'room-sign'].includes(e.shape) &&
            e.x >= r.x &&
            e.y >= r.y &&
            e.x + e.width <= r.x + r.width &&
            e.y + e.height <= r.y + r.height,
        );
        const fill = pieces.reduce((a, p) => a + p.width * p.height, 0) / (r.width * r.height);
        expect(fill, `${t.kind} ${r.label}`).toBeLessThan(0.4);
      }
    }
  });
});
