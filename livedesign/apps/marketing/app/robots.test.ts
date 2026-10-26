import { describe, expect, it } from 'vitest';
import robots from './robots';

describe('robots.txt', () => {
  it('points crawlers at every sitemap on the origin', () => {
    expect(robots().sitemap).toEqual([
      'https://www.livedesign.app/sitemap.xml',
      'https://www.livedesign.app/help/sitemap.xml',
    ]);
  });

  it('keeps the editor and the api out of the crawl', () => {
    const rules = robots().rules as { disallow: string[] };
    expect(rules.disallow).toContain('/api/');
  });
});
