import { describe, expect, it } from 'vitest';
import { ARTICLE_ZONE_MAX } from './article-flow';
import {
  hasZoneBlock,
  withZoneSize,
  withZonesFitted,
  zoneHeightMax,
  zonePlanFor,
} from './article-intake';
import { layOutPages, type Page } from './page';
import type { Element } from './index';

// docs/specs/007-editor/article-pages.md "Zones": an object zone hugs its object, and a stored zone is read back
// within ARTICLE_ZONE_MIN..ARTICLE_ZONE_MAX, so the object is never taller than the zone holding it.
const pages: Page[] = [{ id: 'd1', orientation: 'portrait', kind: 'article', flow: 'f' }];
const p1 = layOutPages(pages)[0]!.rect;
const tall = (width: number, height: number) =>
  ({
    id: 'pic',
    type: 'image',
    imageId: 'img',
    x: p1.x + 100,
    y: p1.y + 100,
    width,
    height,
  }) as Element;

// docs/specs/007-editor/blueprints/article-pages.md "Zones", step 5: writing without a zone has nothing to fit, and the
// pages laid out once serve every article's fit.
describe('fitting writing with and without zones', () => {
  const zone = {
    id: 'z',
    type: 'zone' as const,
    zone: 'object' as const,
    width: 600,
    height: 2000,
    at: { page: 'd1', x: 100, y: 100 },
  };
  const para = { id: 'p', type: 'paragraph' as const, runs: [{ text: 'Hi' }] };

  it('knows writing that holds a zone', () => {
    expect(hasZoneBlock({ blocks: [para] })).toBe(false);
    expect(hasZoneBlock({ blocks: [para, zone] })).toBe(true);
  });

  it('answers the same tab for writing without a zone', () => {
    const tab = { elements: [tall(600, 900)], pages, articles: { f: { blocks: [para] } } };
    expect(withZonesFitted(tab, 'f', 640)).toBe(tab);
  });

  it('fits the same with the pages handed in as laid out here', () => {
    const tab = { elements: [tall(600, 2564)], pages, articles: { f: { blocks: [zone] } } };
    expect(withZonesFitted(tab, 'f', 640, undefined, layOutPages(pages))).toEqual(
      withZonesFitted(tab, 'f', 640),
    );
  });
});

describe('an object zone fitted to a tall object', () => {
  it('scales the object to the tallest zone, keeping its shape, and stores the zone as it reads back', () => {
    const tab = {
      elements: [tall(600, 2564)],
      pages,
      articles: {
        f: {
          blocks: [
            {
              id: 'z',
              type: 'zone' as const,
              zone: 'object' as const,
              width: 600,
              height: 2000,
              at: { page: 'd1', x: 100, y: 100 },
            },
          ],
        },
      },
    };
    const out = withZonesFitted(tab, 'f', 640);
    const pic = out.elements[0] as Extract<Element, { width: number }>;
    expect(pic.height).toBe(ARTICLE_ZONE_MAX);
    expect(pic.width).toBe(Math.round(600 * (ARTICLE_ZONE_MAX / 2564)));
    const z = out.articles.f.blocks[0]!;
    expect(z.type === 'zone' && [z.width, z.height]).toEqual([pic.width, pic.height]);
    // Fitted once, it stays: a second pass changes nothing.
    expect(withZonesFitted(out, 'f', 640)).toBe(out);
  });

  it('plans a dropped tall object within the tallest zone too', () => {
    const plan = zonePlanFor([tall(300, 6000)], [], 640);
    expect(plan.height).toBe(ARTICLE_ZONE_MAX);
    expect(plan.width).toBe(100);
    expect(plan.scale).toBeCloseTo(ARTICLE_ZONE_MAX / 6000);
  });
});

// A zone taller than a page's text area could never sit on a page: every zone is held to it.
describe('a zone held to the text area', () => {
  const textHeight = 900;
  const zoneTab = (zone: 'object' | 'drawing', height: number, elements: Element[]) => ({
    elements,
    pages,
    articles: {
      f: {
        blocks: [
          {
            id: 'z',
            type: 'zone' as const,
            zone,
            width: 600,
            height,
            at: { page: 'd1', x: 100, y: 100 },
          },
        ],
      },
    },
  });

  it('caps at the text area, never past the tallest zone nor under the least', () => {
    expect(zoneHeightMax(textHeight)).toBe(900);
    expect(zoneHeightMax(5000)).toBe(ARTICLE_ZONE_MAX);
    expect(zoneHeightMax()).toBe(ARTICLE_ZONE_MAX);
    expect(zoneHeightMax(3)).toBe(24);
  });

  it('scales a picture between the text height and 2,000 px to fit a page', () => {
    const plan = zonePlanFor([tall(600, 1500)], [], 640, textHeight);
    expect(plan.height).toBe(900);
    expect(plan.width).toBe(360);
    const out = withZonesFitted(zoneTab('object', 1500, [tall(600, 1500)]), 'f', 640, textHeight);
    const pic = out.elements[0] as Extract<Element, { width: number }>;
    expect([pic.width, pic.height]).toEqual([360, 900]);
  });

  it('plans, grows and sizes a drawing zone no taller than a page holds', () => {
    const plan = zonePlanFor([tall(100, 1400), tall(100, 50)], [], 640, textHeight);
    expect(plan.zone).toBe('drawing');
    expect(plan.height).toBe(900);
    // A member reaching far down grows the zone to the cap, no further (a reload reads back the same).
    const shape = { ...tall(100, 1200), id: 's', type: 'shape', shape: 'square' } as Element;
    const grown = withZonesFitted(zoneTab('drawing', 800, [shape]), 'f', 640, textHeight);
    const z = grown.articles.f.blocks[0]!;
    expect(z.type === 'zone' && z.height).toBe(900);
    const sized = withZoneSize(
      zoneTab('drawing', 240, []),
      'f',
      'z',
      { height: 1800 },
      640,
      textHeight,
    );
    const s2 = sized.articles.f.blocks[0]!;
    expect(s2.type === 'zone' && s2.height).toBe(900);
  });
});
