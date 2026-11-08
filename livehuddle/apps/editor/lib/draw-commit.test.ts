import type { Tab } from '@livehuddle/document';
import { COMPONENT_SIZE, isBoxed } from '@livehuddle/document';
import { describe, expect, it } from 'vitest';
import { buildDrawnBoxed, buildDrawnComponent } from './draw-commit';

const tab = (overrides: Partial<Tab> = {}): Tab => ({
  id: 't',
  name: 'T',
  elements: [],
  ...overrides,
});

describe('buildDrawnComponent', () => {
  it('drops one element at its natural size, centred on a tap', () => {
    const out = buildDrawnComponent('avatar', 500, 300, 503, 302);
    if (!isBoxed(out)) throw new Error('expected a boxed element');
    expect(out).toMatchObject(COMPONENT_SIZE.avatar);
    expect(out.x + out.width / 2).toBe(500);
    expect(out.y + out.height / 2).toBe(300);
  });

  it('keeps an aspect-locked avatar square, centred in the dragged box', () => {
    const out = buildDrawnComponent('avatar', 0, 0, 300, 100);
    expect(out).toMatchObject({ x: 100, y: 0, width: 100, height: 100 });
  });
});

describe('buildDrawnBoxed', () => {
  // docs/specs/009-elements/office.md "Dropped, then sized": a press-and-drag with Room armed drops it at its default
  // size where the press began, never a drawn box; a Stage still draws to the box.
  it('drops a dragged Room at its default size, centred where the press began', () => {
    const room = buildDrawnBoxed({ type: 'shape', kind: 'room' }, 500, 300, 900, 700, null, tab());
    expect(room).toMatchObject({ x: 500 - 240, y: 300 - 160, width: 480, height: 320 });
    const stage = buildDrawnBoxed(
      { type: 'shape', kind: 'stage' },
      500,
      300,
      900,
      700,
      null,
      tab(),
    );
    expect(stage).toMatchObject({ x: 500, y: 300, width: 400, height: 400 });
  });

  const shapeIntent = { type: 'shape', kind: 'square' } as const;

  it('centres the factory-default size on a tap', () => {
    const out = buildDrawnBoxed(shapeIntent, 500, 300, 504, 303, null, tab());
    expect(out.width).toBe(120); // square factory default
    expect(out.height).toBe(120);
    expect(out.x).toBe(500 - 60);
    expect(out.y).toBe(300 - 60);
  });

  it('sizes to the dragged box, normalising a backwards drag', () => {
    const out = buildDrawnBoxed(shapeIntent, 200, 100, 10, 20, null, tab());
    expect({ x: out.x, y: out.y, width: out.width, height: out.height }).toEqual({
      x: 10,
      y: 20,
      width: 190,
      height: 80,
    });
  });

  it("seeds the tab's default text size (docs/specs/004-interface-design/fonts.md)", () => {
    const seeded = buildDrawnBoxed(shapeIntent, 0, 0, 3, 3, null, tab({ defaultTextSize: 'lg' }));
    expect(seeded.textSize).toBe('lg');
    const unseeded = buildDrawnBoxed(shapeIntent, 0, 0, 3, 3, null, tab());
    expect(unseeded.textSize).toBe('md'); // the shape factory's own default
  });

  it('draws a sticky to the dragged box, with no tilt and no fixed size', () => {
    const plain = buildDrawnBoxed({ type: 'sticky' }, 0, 0, 3, 3, null, tab());
    expect('fillColor' in plain && plain.fillColor != null).toBe(false);
    const dragged = buildDrawnBoxed({ type: 'sticky' }, 0, 0, 500, 400, null, tab());
    expect(dragged.width).toBe(500);
    expect((dragged as { fixedSize?: boolean }).fixedSize).toBeUndefined();
    expect(dragged.rotation).toBeUndefined();
  });

  it('carries the icon glyph + label, unlocking aspect for a tech mark (docs/specs/010-palette/technology-icons.md)', () => {
    const intent = { type: 'shape', kind: 'square', iconId: 'aws-s3', label: 'S3' } as const;
    const out = buildDrawnBoxed(intent, 0, 0, 100, 100, null, tab());
    expect(out).toMatchObject({ iconId: 'aws-s3', label: 'S3', aspectLocked: false });
  });

  it('draws a link card to the dragged box (docs/specs/009-elements/link-cards.md)', () => {
    const out = buildDrawnBoxed({ type: 'link-card' }, 10, 10, 210, 110, null, tab());
    expect(out).toMatchObject({ type: 'link-card', x: 10, y: 10, width: 200, height: 100 });
  });

  it('anchors a dragged image at the drawn top-left, uncentred', () => {
    const out = buildDrawnBoxed({ type: 'image' }, 40, 60, 240, 160, null, tab());
    expect({ x: out.x, y: out.y, width: out.width, height: out.height }).toEqual({
      x: 40,
      y: 60,
      width: 200,
      height: 100,
    });
  });
});
