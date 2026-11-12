import { describe, expect, it } from 'vitest';
import { tagHref } from './links';
import {
  carrySearch,
  EMPTY_FILTERS,
  hasActiveFilters,
  readQueryState,
  searchEcho,
  searchedWordsChanged,
  writeQueryState,
} from './query-state';

// Query state round trip (blueprint §13): the gallery's filters survive the URL both ways, defaults
// stay out of it, and a stale or hand-edited link still shows something.
const read = (search: string) => readQueryState(new URLSearchParams(search));

describe('readQueryState', () => {
  it('reads an empty query as the defaults', () => {
    expect(read('')).toEqual(EMPTY_FILTERS);
  });

  it('reads every filter', () => {
    expect(read('?q=cloud+map&category=software&tag=aws&sort=loved')).toEqual({
      q: 'cloud map #aws category:software sort:loved',
      category: 'software',
      categoryApp: null,
      tag: null,
      sort: 'loved',
    });
  });

  it('normalises the tag as the api does', () => {
    expect(read('?tag=Event_Storming').q).toBe('#event-storming');
    // Already in the search: not added twice.
    expect(read('?q=%23aws&tag=aws').q).toBe('#aws');
  });

  it('keeps an accented or non-Latin tag from a link', () => {
    expect(read(`?tag=${encodeURIComponent('Café')}`).q).toBe('#café');
    expect(read(`?q=${encodeURIComponent('#日本語')}`).q).toBe('#日本語');
    // A tag's link (`tagHref`) reads back as that tag.
    expect(read(tagHref('हिन्दी').split('?')[1]!).q).toBe('#हिन्दी');
  });

  it('drops an unknown category but keeps the rest', () => {
    expect(read('?category=nope&q=kanban')).toEqual({ ...EMPTY_FILTERS, q: 'kanban' });
  });

  it("drops another app's category, as a parameter or a search word, and keeps the app's own", () => {
    const design = (search: string) =>
      readQueryState(new URLSearchParams(search), 'livedesign.app');
    expect(design('?category=software&q=kanban')).toEqual({ ...EMPTY_FILTERS, q: 'kanban' });
    expect(design('?q=kanban+category:software')).toEqual({ ...EMPTY_FILTERS, q: 'kanban' });
    expect(design('?q=kanban+category:livediagram/software')).toEqual({
      ...EMPTY_FILTERS,
      q: 'kanban',
    });
    expect(design('?q=category:branding').q).toBe('category:branding');
    expect(design('?category=branding').q).toBe('category:branding');
    // Its own, named with the app (from All Apps), reads bare.
    expect(design('?q=category:livedesign/branding')).toMatchObject({
      q: 'category:branding',
      category: 'branding',
      categoryApp: null,
    });
    // Without a scope, any category stands as written.
    expect(read('?q=category:software').q).toBe('category:software');
  });

  it('names each category with its app on All Apps, where a bare id reads as none', () => {
    const all = (search: string) => readQueryState(new URLSearchParams(search), 'all');
    expect(all('?q=category:liveplanner/meetings+retro')).toEqual({
      ...EMPTY_FILTERS,
      q: 'category:liveplanner/meetings retro',
      category: 'meetings',
      categoryApp: 'liveplanner.app',
    });
    expect(all('?q=retro+category:meetings')).toEqual({ ...EMPTY_FILTERS, q: 'retro' });
    expect(all('?category=meetings&q=retro')).toEqual({ ...EMPTY_FILTERS, q: 'retro' });
  });

  it('drops a tag that does not normalise but keeps the rest', () => {
    expect(read('?tag=%21&sort=copied')).toEqual({
      ...EMPTY_FILTERS,
      q: 'sort:copied',
      sort: 'copied',
    });
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

  it('writes the sort inside q, never as its own parameter', () => {
    expect(writeQueryState({ ...EMPTY_FILTERS, q: 'retro sort:loved', sort: 'loved' })).toBe(
      '?q=retro+sort%3Aloved',
    );
    expect(read('?q=retro+sort%3Acopied').sort).toBe('copied');
  });

  it('writes everything inside q, defaults omitted', () => {
    expect(
      writeQueryState({ ...EMPTY_FILTERS, q: 'retro category:retros', category: 'retros' }),
    ).toBe('?q=retro+category%3Aretros');
    expect(writeQueryState(EMPTY_FILTERS)).toBe('');
  });

  it('round trips through the URL', () => {
    const filters = {
      q: 'user journey #ux category:processes sort:copied',
      category: 'processes',
      categoryApp: null,
      tag: null,
      sort: 'copied',
    } as const;
    expect(read(writeQueryState(filters))).toEqual(filters);
  });
});

describe('hasActiveFilters', () => {
  it('is false for the defaults, whatever the sort', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, sort: 'loved' })).toBe(false);
  });

  it('is true for a search, a category or a tag', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, q: 'x' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, category: 'ideas' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, tag: 'aws' })).toBe(true);
  });
});

describe('searchedWordsChanged', () => {
  it('is a search only when the typed words change', () => {
    expect(searchedWordsChanged('', 'retro')).toBe(true);
    expect(searchedWordsChanged('retro', 'retro board')).toBe(true);
    // A control writing its own word is not a search.
    expect(searchedWordsChanged('retro', 'retro #agile')).toBe(false);
    expect(searchedWordsChanged('retro', 'retro category:planning sort:loved')).toBe(false);
    expect(searchedWordsChanged('', 'is:mine')).toBe(false);
    // Clearing the words is not a search either.
    expect(searchedWordsChanged('retro', '')).toBe(false);
  });
});

describe('searchEcho', () => {
  it('is what the address hands back for a typed search', () => {
    expect(searchEcho('cloud ')).toBe('cloud');
    expect(searchEcho('retro sort:')).toBe('retro');
    expect(searchEcho('#AWS sort:loved')).toBe('#AWS sort:loved');
  });
});

describe('carrySearch', () => {
  const LD = 'livediagram.app';
  it('names the chosen category with the app on the way to All Apps, and takes My Shares out', () => {
    expect(carrySearch('?q=is%3Amine+retro+category%3Aretros', 'all', LD)).toBe(
      '?q=retro+category%3Alivediagram%2Fretros',
    );
    // Not the app's own: left out.
    expect(carrySearch('?q=category%3Abranding', 'all', LD)).toBe('');
    expect(carrySearch('?q=retro', 'all', LD)).toBeNull();
  });

  it("reads the app's own bare on the way back, and leaves another app's out", () => {
    expect(carrySearch('?q=category%3Alivediagram%2Fretros', 'app', LD)).toBe(
      '?q=category%3Aretros',
    );
    expect(carrySearch('?q=x+category%3Aliveplanner%2Fmeetings', 'app', LD)).toBe('?q=x');
    expect(carrySearch('?q=category%3Aretros', 'app', LD)).toBeNull();
  });
});
