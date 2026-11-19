import { describe, expect, it } from 'vitest';
import { APP_ORDER, appliesTo, articlePath } from '@liveworkspace/help-registry';
import { allArticles, searchIndexFor } from '@liveworkspace/help-registry/catalogue';

// The search box's indexes (app/search-index.json, app/search-all.json; liveworkspace/docs/specs/016-help/
// help-centre.md "Search"): an app's help fetches only its own articles on the first search, and every app's only
// when its "From Other Apps" group is wanted. These caps keep both small enough for a phone on a slow line. Sizes
// are the JSON a build writes, before compression; estimated from the catalogue at about 115 KB for livediagram's
// index and 180 KB for every app's when the caps were set (2026-11-19). Raise a cap only with a reason: a bigger
// index is a slower first search for every reader.
const APP_INDEX_MAX_BYTES = 160_000;
const ALL_INDEX_MAX_BYTES = 260_000;

const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

describe('the search indexes', () => {
  for (const app of APP_ORDER) {
    it(`${app}'s index holds only its own articles, within ${APP_INDEX_MAX_BYTES} bytes`, () => {
      const index = searchIndexFor(app);
      const own = allArticles
        .filter((a) => appliesTo(a, app))
        .map(articlePath)
        .sort();
      expect(index.map(articlePath).sort()).toEqual(own);
      expect(bytes(index)).toBeLessThanOrEqual(APP_INDEX_MAX_BYTES);
    });
  }

  it(`every app's index holds every article, within ${ALL_INDEX_MAX_BYTES} bytes`, () => {
    const index = searchIndexFor('all');
    expect(index).toHaveLength(allArticles.length);
    expect(bytes(index)).toBeLessThanOrEqual(ALL_INDEX_MAX_BYTES);
  });

  it('carries only the fields a result reads', () => {
    for (const entry of searchIndexFor('all'))
      expect(Object.keys(entry).sort()).toEqual([
        'apps',
        'category',
        'categorySlug',
        'description',
        'keywords',
        'slug',
        'title',
      ]);
  });
});
