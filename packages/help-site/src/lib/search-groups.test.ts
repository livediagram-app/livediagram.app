import { describe, expect, it } from 'vitest';
import type { Article } from '@liveworkspace/help-registry';
import { groupResults, OTHER_APPS_MAX } from './search-groups';
import { locationWithQuery, queryFromLocation } from './search-query';

const a = (slug: string, apps: Article['apps']): Article => ({
  slug,
  title: slug,
  description: '',
  keywords: '',
  category: 'c',
  categorySlug: 'c',
  apps,
});

describe('search groups', () => {
  const results = [
    a('one', ['livediagram']),
    a('two', ['liveplanner']),
    a('three', ['livediagram', 'liveplanner']),
    ...['x', 'y', 'z', 'w'].map((s) => a(s, ['livedesign'])),
  ];
  it("puts the scope's results first and caps the other apps'", () => {
    const { here, elsewhere } = groupResults(results, 'livediagram');
    expect(here.map((r) => r.slug)).toEqual(['one', 'three']);
    expect(elsewhere).toHaveLength(OTHER_APPS_MAX);
    expect(elsewhere[0]!.slug).toBe('two');
  });
  it("takes the other apps' results from the every-app index once it has loaded", () => {
    const own = [a('one', ['livediagram']), a('three', ['livediagram', 'liveplanner'])];
    const others = [a('three', ['livediagram', 'liveplanner']), a('two', ['liveplanner'])];
    const { here, elsewhere } = groupResults(own, 'livediagram', others);
    expect(here.map((r) => r.slug)).toEqual(['one', 'three']);
    expect(elsewhere.map((r) => r.slug)).toEqual(['two']);
    expect(groupResults(own, 'livediagram').elsewhere).toEqual([]);
  });
  it('keeps one list under All Apps', () => {
    expect(groupResults(results, 'all')).toEqual({ here: results, elsewhere: [] });
  });
});

describe('the query in the address', () => {
  it('reads, sets and clears q, capped', () => {
    expect(queryFromLocation('?q=share%20link')).toBe('share link');
    expect(queryFromLocation('?q=' + 'a'.repeat(300))).toHaveLength(200);
    expect(locationWithQuery('https://x.test/help/a/?q=old', ' new ')).toBe(
      'https://x.test/help/a/?q=new',
    );
    expect(locationWithQuery('https://x.test/help/a/?q=old', '')).toBe('https://x.test/help/a/');
  });
});
