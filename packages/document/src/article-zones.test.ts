import { describe, expect, it } from 'vitest';
import { drawingZoneClips, withZonesSettled, zoneMemberIds } from './article-zones';
import { layOutIllustratePages, type IllustratePage } from './illustrate-page';
import type { Element } from './index';

const pages: IllustratePage[] = [
  { id: 'd1', orientation: 'portrait', kind: 'article', flow: 'f' },
  { id: 'd2', orientation: 'portrait', kind: 'article', flow: 'f' },
];
const laid = layOutIllustratePages(pages);
const box = (id: string, x: number, y: number) =>
  ({ id, type: 'shape', shape: 'square', x, y, width: 20, height: 20 }) as Element;
const zone = (id: string, at?: { page: string; x: number; y: number }) => ({
  id,
  type: 'zone' as const,
  zone: 'drawing' as const,
  width: 200,
  height: 100,
  ...(at ? { at } : {}),
});

describe('zones settled where the writing lays them out', () => {
  const p1 = laid[0]!.rect;
  const p2 = laid[1]!.rect;
  const inZone = box('in', p1.x + 110, p1.y + 110);
  const outside = box('out', p1.x + 500, p1.y + 500);
  const tab = {
    elements: [inZone, outside],
    pages,
    articles: { f: { blocks: [zone('z', { page: 'd1', x: 100, y: 100 })] } },
  };

  it('finds the elements inside a zone by their centre', () => {
    expect(
      zoneMemberIds(tab.elements, { x: p1.x + 100, y: p1.y + 100, width: 200, height: 100 }),
    ).toEqual(new Set(['in']));
  });

  it("moves a zone's elements with it, onto another page too", () => {
    const out = withZonesSettled(tab, 'f', [{ id: 'z', index: 1, x: 100, y: 300 }]);
    const moved = out.elements.find((e) => e.id === 'in') as Extract<Element, { x: number }>;
    expect(moved.x).toBe(p2.x + 110);
    expect(moved.y).toBe(p2.y + 310);
    expect(out.elements.find((e) => e.id === 'out')).toBe(outside);
    const b = out.articles.f.blocks[0]!;
    expect(b.type === 'zone' && b.at).toEqual({ page: 'd2', x: 100, y: 300 });
  });

  it('keeps the tab when nothing moved, and waits for a page that is not there yet', () => {
    expect(withZonesSettled(tab, 'f', [{ id: 'z', index: 0, x: 100.4, y: 100 }])).toBe(tab);
    expect(withZonesSettled(tab, 'f', [{ id: 'z', index: 5, x: 0, y: 0 }])).toBe(tab);
  });

  it('places a zone laid out for the first time without moving anything', () => {
    const fresh = { ...tab, articles: { f: { blocks: [zone('z')] } } };
    const out = withZonesSettled(fresh, 'f', [{ id: 'z', index: 0, x: 96, y: 200 }]);
    expect(out.elements).toBe(fresh.elements);
  });

  it("does not hand one zone's elements to another moving into its place", () => {
    const two = {
      ...tab,
      articles: {
        f: {
          blocks: [
            zone('a', { page: 'd1', x: 100, y: 100 }),
            zone('b', { page: 'd1', x: 100, y: 300 }),
          ],
        },
      },
    };
    const inB = box('inB', p1.x + 110, p1.y + 310);
    const out = withZonesSettled({ ...two, elements: [inZone, inB] }, 'f', [
      { id: 'a', index: 0, x: 100, y: 300 },
      { id: 'b', index: 0, x: 100, y: 500 },
    ]);
    const ys = Object.fromEntries(out.elements.map((e) => [e.id, (e as { y: number }).y - p1.y]));
    expect(ys).toEqual({ in: 310, inB: 510 });
  });
});

describe('a drawing zone cuts off its drawing at its edge', () => {
  const p1 = laid[0]!.rect;
  const rect = { x: p1.x + 100, y: p1.y + 100, width: 200, height: 100 };
  const articles = { f: { blocks: [zone('z', { page: 'd1', x: 100, y: 100 })] } };
  const drawing = () => true;

  it('clips members, and boxes poking in from outside, to the zone', () => {
    const inside = box('in', p1.x + 110, p1.y + 110);
    const pokingIn = box('poke', p1.x + 85, p1.y + 150);
    const away = box('away', p1.x + 500, p1.y + 500);
    const clips = drawingZoneClips(laid, articles, [inside, pokingIn, away], drawing);
    expect(clips.get('in')).toEqual(rect);
    expect(clips.get('poke')).toEqual(rect);
    expect(clips.has('away')).toBe(false);
  });

  it('never clips an object (it floats whole)', () => {
    const clips = drawingZoneClips(
      laid,
      articles,
      [box('img', p1.x + 110, p1.y + 110)],
      () => false,
    );
    expect(clips.size).toBe(0);
  });
});
