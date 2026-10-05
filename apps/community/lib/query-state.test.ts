import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, hasActiveFilters, readQueryState, writeQueryState } from './query-state';

// Query state round trip (blueprint §13): the gallery's filters survive the URL both ways, defaults
// stay out of it, and a stale or hand-edited link still shows something.
const read = (search: string) => readQueryState(new URLSearchParams(search));

describe('readQueryState', () => {
  it('reads an empty query as the defaults', () => {
    expect(read('')).toEqual(EMPTY_FILTERS);
  });

  it('reads every filter', () => {
    expect(read('?q=cloud+map&category=architecture&tag=aws&sort=loved')).toEqual({
      q: 'cloud map',
      category: 'architecture',
      tag: 'aws',
      sort: 'loved',
    });
  });

  it('normalises the tag as the api does', () => {
    expect(read('?tag=Event_Storming').tag).toBe('event-storming');
  });

  it('drops an unknown category but keeps the rest', () => {
    expect(read('?category=nope&q=kanban')).toEqual({ ...EMPTY_FILTERS, q: 'kanban' });
  });

  it('drops a tag that does not normalise but keeps the rest', () => {
    expect(read('?tag=%21&sort=copied')).toEqual({ ...EMPTY_FILTERS, sort: 'copied' });
  });

  it('falls back to Newest for an unknown sort', () => {
    expect(read('?sort=random').sort).toBe('new');
  });

  it('ignores an offset: the gallery always starts at the top', () => {
    expect(read('?offset=48')).toEqual(EMPTY_FILTERS);
  });
});

describe('writeQueryState', () => {
  it('writes nothing for the defaults', () => {
    expect(writeQueryState(EMPTY_FILTERS)).toBe('');
  });

  it('omits the default sort and writes the rest', () => {
    expect(writeQueryState({ ...EMPTY_FILTERS, q: 'retro', category: 'workshops' })).toBe(
      '?q=retro&category=workshops',
    );
  });

  it('round trips through the URL', () => {
    const filters = { q: 'user journey', category: 'flows', tag: 'ux', sort: 'copied' } as const;
    expect(read(writeQueryState(filters))).toEqual(filters);
  });
});

describe('hasActiveFilters', () => {
  it('is false for the defaults, whatever the sort', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, sort: 'loved' })).toBe(false);
  });

  it('is true for a search, a category or a tag', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, q: 'x' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, category: 'art' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, tag: 'aws' })).toBe(true);
  });
});
