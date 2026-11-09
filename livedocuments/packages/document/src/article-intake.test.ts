import { describe, expect, it } from 'vitest';
import { ARTICLE_ZONE_MAX } from './article-flow';
import { withZonesFitted, zonePlanFor } from './article-intake';
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
