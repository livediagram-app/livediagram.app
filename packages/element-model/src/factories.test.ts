import { describe, expect, it } from 'vitest';
import {
  createAnnotation,
  createArrow,
  createFreehand,
  createImage,
  createLinkCard,
  createPinnedArrow,
  createSticky,
  createTable,
  createText,
  createVideo,
  scaleElements,
} from './factories';

describe('element factories', () => {
  it('drops each kind at the point with its default size and a fresh id', () => {
    const made = [
      createText(1, 2),
      createTable(1, 2),
      createSticky(1, 2),
      createAnnotation(1, 2),
      createLinkCard(1, 2),
      createVideo(1, 2),
      createImage(1, 2),
    ];
    expect(made.map((el) => [el.type, el.width, el.height])).toEqual([
      ['text', 220, 64],
      ['table', 360, 150],
      ['sticky', 200, 200],
      ['annotation', 44, 44],
      ['link-card', 280, 120],
      ['video', 480, 270],
      ['image', 200, 150],
    ]);
    for (const el of made) expect(el).toMatchObject({ x: 1, y: 2 });
    expect(new Set(made.map((el) => el.id)).size).toBe(made.length);
    expect(createTable(0, 0).cells).toEqual([
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
    ]);
    expect(createImage(0, 0).imageId).toBeNull();
  });

  it('names a video provider only when one is given', () => {
    expect(createVideo(0, 0, 'vimeo').embedProvider).toBe('vimeo');
    expect('embedProvider' in createVideo(0, 0)).toBe(false);
  });

  it('packs a freehand stroke into its box', () => {
    const stroke = createFreehand(
      [
        { x: 10, y: 10 },
        { x: 30, y: 50 },
      ],
      false,
    );
    // The box pads the stroke by a pixel each side.
    expect(stroke).toMatchObject({
      type: 'freehand',
      x: 9,
      y: 9,
      width: 22,
      height: 42,
      closed: false,
    });
    expect(typeof stroke.packedPoints).toBe('string');
  });

  it('makes free and pinned arrows', () => {
    expect(createArrow(0, 1, 2, 3)).toMatchObject({
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 1 },
      to: { kind: 'free', x: 2, y: 3 },
    });
    expect(createPinnedArrow('a', 'right', 'b', 'left')).toMatchObject({
      from: { kind: 'pinned', elementId: 'a', anchor: 'right' },
      to: { kind: 'pinned', elementId: 'b', anchor: 'left' },
    });
  });
});

describe('scaleElements', () => {
  it('scales boxes about the origin and only the free ends of an arrow', () => {
    const box = { ...createSticky(10, 20), width: 10, height: 10 };
    const arrow = {
      id: 'a',
      type: 'arrow' as const,
      from: { kind: 'free', x: 10, y: 10 },
      to: { kind: 'pinned', elementId: box.id, anchor: 'top' },
    };
    const [scaledBox, scaledArrow] = scaleElements<typeof box | typeof arrow>(
      [box, arrow],
      0,
      0,
      2,
    );
    expect(scaledBox).toMatchObject({ x: 20, y: 40, width: 20, height: 20 });
    expect(scaledArrow).toMatchObject({ from: { x: 20, y: 20 }, to: arrow.to });
  });
});
