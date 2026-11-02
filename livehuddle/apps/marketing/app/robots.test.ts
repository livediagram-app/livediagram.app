import { describe, expect, it } from 'vitest';
import robots from './robots';

describe('robots.txt', () => {
  it('points crawlers at every sitemap on the origin', () => {
    expect(robots().sitemap).toEqual([
      'https://www.livehuddle.app/sitemap.xml',
      'https://www.livehuddle.app/help/sitemap.xml',
      'https://www.livehuddle.app/community/sitemap.xml',
    ]);
  });

  it('keeps the editor and the api out of the crawl, never the Community', () => {
    const rules = robots().rules as { disallow: string[] };
    expect(rules.disallow).toContain('/api/');
    expect(rules.disallow.some((path) => path.startsWith('/community'))).toBe(false);
  });
});
