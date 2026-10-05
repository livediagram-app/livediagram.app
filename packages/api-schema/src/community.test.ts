import { describe, expect, it } from 'vitest';
import {
  COMMUNITY_CATEGORIES,
  COMMUNITY_DESCRIPTION_MAX,
  COMMUNITY_MAX_OFFSET,
  COMMUNITY_TAGS_MAX,
  COMMUNITY_TITLE_MAX,
  communityQueryParams,
  communitySearchCategory,
  communitySearchSort,
  setCommunitySearchCategory,
  communitySearchTags,
  communitySearchTerms,
  setCommunitySearchSort,
  toggleCommunitySearchTag,
  isCommunityKey,
  normaliseCommunityTag,
  parseCommunityListQuery,
  validateCommunityPostInput,
  communityInputErrorField,
  communityPostInputErrors,
} from './community';

const valid = {
  title: 'Payments platform',
  description: 'How our payment services talk to each other, end to end.',
  category: 'architecture',
  tags: ['AWS', 'event driven'],
};

describe('normaliseCommunityTag', () => {
  it.each([
    ['AWS', 'aws'],
    ['  Event Driven  ', 'event-driven'],
    ['snake_case_tag', 'snake-case-tag'],
    ['C++ & Rust!', 'c-rust'],
    ['--edge--', 'edge'],
    ['a  -  b', 'a-b'],
    ['naïve', 'nave'],
  ])('%s -> %s', (raw, want) => {
    expect(normaliseCommunityTag(raw)).toBe(want);
  });

  it('rejects tags outside 2..24 characters after normalisation', () => {
    expect(normaliseCommunityTag('a')).toBeNull();
    expect(normaliseCommunityTag('!!!')).toBeNull();
    expect(normaliseCommunityTag('x'.repeat(24))).toBe('x'.repeat(24));
    expect(normaliseCommunityTag('x'.repeat(25))).toBeNull();
  });
});

describe('validateCommunityPostInput', () => {
  it('accepts a valid post, normalising and de-duplicating tags', () => {
    const result = validateCommunityPostInput({ ...valid, tags: ['AWS', 'aws', 'Event  driven'] });
    expect(result).toEqual({
      ok: true,
      value: { ...valid, tags: ['aws', 'event-driven'], anonymous: true },
    });
  });

  it('trims the title and collapses its whitespace', () => {
    const result = validateCommunityPostInput({ ...valid, title: '  My   board  ' });
    expect(result.ok && result.value.title).toBe('My board');
  });

  it('collapses long blank runs in the description', () => {
    const result = validateCommunityPostInput({
      ...valid,
      description: 'First paragraph here.\r\n\r\n\r\n\r\nSecond paragraph.',
    });
    expect(result.ok && result.value.description).toBe(
      'First paragraph here.\n\nSecond paragraph.',
    );
  });

  it.each([
    [{ title: 'ab' }, 'invalid_title'],
    [{ title: 'x'.repeat(COMMUNITY_TITLE_MAX + 1) }, 'invalid_title'],
    [{ title: 42 }, 'invalid_title'],
    [{ description: 'too short' }, 'invalid_description'],
    [{ description: 'x'.repeat(COMMUNITY_DESCRIPTION_MAX + 1) }, 'invalid_description'],
    [{ category: 'cats' }, 'invalid_category'],
    [{ tags: 'aws' }, 'invalid_tags'],
    [{ tags: ['ok', '!'] }, 'invalid_tags'],
    [{ tags: [1] }, 'invalid_tags'],
    [{ tags: Array.from({ length: COMMUNITY_TAGS_MAX + 1 }, (_, i) => `tag${i}`) }, 'invalid_tags'],
  ])('rejects %j with %s', (patch, error) => {
    expect(validateCommunityPostInput({ ...valid, ...patch })).toEqual({ ok: false, error });
  });

  it('rejects a missing body', () => {
    expect(validateCommunityPostInput(null)).toEqual({ ok: false, error: 'invalid_title' });
  });
});

describe('anonymous', () => {
  it('is on unless the author turns it off', () => {
    const on = validateCommunityPostInput(valid);
    expect(on.ok && on.value.anonymous).toBe(true);
    const off = validateCommunityPostInput({ ...valid, anonymous: false });
    expect(off.ok && off.value.anonymous).toBe(false);
    const junk = validateCommunityPostInput({ ...valid, anonymous: 'no' });
    expect(junk.ok && junk.value.anonymous).toBe(true);
  });
});

describe('communityPostInputErrors', () => {
  it('is empty for a valid post', () => {
    expect(communityPostInputErrors(valid)).toEqual([]);
  });

  it('reports every failing field at once, in field order', () => {
    expect(
      communityPostInputErrors({ title: 'x', description: 'short', category: null, tags: ['!'] }),
    ).toEqual(['invalid_title', 'invalid_description', 'invalid_category', 'invalid_tags']);
    expect(communityPostInputErrors({ ...valid, description: 'short', category: 'nope' })).toEqual([
      'invalid_description',
      'invalid_category',
    ]);
  });

  it('maps a code to its field, and a non-field refusal to none', () => {
    expect(communityInputErrorField('invalid_description')).toBe('description');
    expect(communityInputErrorField('invalid_tags')).toBe('tags');
    expect(communityInputErrorField('empty_document')).toBeNull();
    expect(communityInputErrorField(null)).toBeNull();
  });
});

describe('parseCommunityListQuery', () => {
  const parse = (qs: string) => parseCommunityListQuery(new URLSearchParams(qs));

  it('defaults an empty query', () => {
    expect(parse('')).toEqual({
      ok: true,
      value: { q: '', category: null, tag: null, sort: 'new', offset: 0 },
    });
  });

  it('reads every field', () => {
    expect(parse('q=retro&category=workshops&tag=Agile&sort=loved&offset=24')).toEqual({
      ok: true,
      value: { q: 'retro', category: 'workshops', tag: 'agile', sort: 'loved', offset: 24 },
    });
  });

  it('is lenient on sort and offset', () => {
    expect(parse('sort=hot&offset=-5')).toMatchObject({
      ok: true,
      value: { sort: 'new', offset: 0 },
    });
    expect(parse('offset=999999')).toMatchObject({ value: { offset: COMMUNITY_MAX_OFFSET } });
    expect(parse('offset=abc')).toMatchObject({ value: { offset: 0 } });
  });

  it('is strict on category and tag', () => {
    expect(parse('category=nope')).toEqual({ ok: false });
    expect(parse('tag=!')).toEqual({ ok: false });
  });

  it('round-trips through communityQueryParams without defaults', () => {
    const value = { q: 'cloud map', category: 'architecture', tag: 'aws', sort: 'copied' } as const;
    const params = communityQueryParams(value);
    expect(params.toString()).toBe('q=cloud+map&category=architecture&tag=aws&sort=copied');
    expect(parse(params.toString())).toEqual({ ok: true, value: { ...value, offset: 0 } });
    expect(communityQueryParams({ q: '', category: null, tag: null, sort: 'new' }).toString()).toBe(
      '',
    );
  });
});

describe('communitySearchTerms', () => {
  it('lowercases, splits, de-duplicates and caps', () => {
    expect(communitySearchTerms('  Cloud  cloud MAP ')).toEqual(['cloud', 'map']);
    expect(communitySearchTerms('a b c d e f g')).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(communitySearchTerms('x'.repeat(50))).toEqual(['x'.repeat(40)]);
    expect(communitySearchTerms('   ')).toEqual([]);
  });
});

describe('search tags', () => {
  it('splits #tags from plain terms', () => {
    expect(communitySearchTerms('retro #Agile #ux board')).toEqual(['retro', 'board']);
    expect(communitySearchTags('retro #Agile #ux board #agile # #!')).toEqual(['agile', 'ux']);
  });

  it('caps the tags at five', () => {
    expect(communitySearchTags('#a1 #a2 #a3 #a4 #a5 #a6')).toHaveLength(5);
  });

  it('toggles one tag, keeping what was typed', () => {
    expect(toggleCommunitySearchTag('retro', 'agile')).toBe('retro #agile');
    expect(toggleCommunitySearchTag('retro #Agile board', 'agile')).toBe('retro board');
    expect(toggleCommunitySearchTag('', 'ux')).toBe('#ux');
  });
});

describe('search sort', () => {
  it('reads the last valid sort token, and keeps it out of the terms', () => {
    expect(communitySearchSort('retro sort:loved')).toBe('loved');
    expect(communitySearchSort('sort:loved Sort:Copied')).toBe('copied');
    expect(communitySearchSort('sort:random retro')).toBeNull();
    expect(communitySearchTerms('retro sort:loved #ux')).toEqual(['retro']);
  });

  it('sets the sort, leaving Newest unwritten', () => {
    expect(setCommunitySearchSort('retro #ux', 'loved')).toBe('retro #ux sort:loved');
    expect(setCommunitySearchSort('retro sort:loved', 'copied')).toBe('retro sort:copied');
    expect(setCommunitySearchSort('retro sort:loved', 'new')).toBe('retro');
  });

  it('wins over the sort parameter', () => {
    const parsed = parseCommunityListQuery(new URLSearchParams('q=retro+sort%3Acopied&sort=loved'));
    expect(parsed.ok && parsed.value.sort).toBe('copied');
  });
});

describe('search category', () => {
  it('reads the last valid category token, and keeps it out of the terms', () => {
    expect(communitySearchCategory('retro category:workshops')).toBe('workshops');
    expect(communitySearchCategory('category:nope retro')).toBeNull();
    expect(communitySearchTerms('retro category:workshops')).toEqual(['retro']);
  });

  it('sets the category, or clears it for All', () => {
    expect(setCommunitySearchCategory('retro', 'planning')).toBe('retro category:planning');
    expect(setCommunitySearchCategory('category:art retro', 'design')).toBe(
      'retro category:design',
    );
    expect(setCommunitySearchCategory('retro category:art', null)).toBe('retro');
  });

  it('wins over the category parameter', () => {
    const parsed = parseCommunityListQuery(
      new URLSearchParams('q=category%3Adata&category=planning'),
    );
    expect(parsed.ok && parsed.value.category).toBe('data');
  });
});

describe('isCommunityKey', () => {
  it('accepts a v4 UUID only', () => {
    expect(isCommunityKey('3f2b8c1e-9a4d-4e7f-8b21-0c5d6e7f8a9b')).toBe(true);
    expect(isCommunityKey('3F2B8C1E-9A4D-4E7F-8B21-0C5D6E7F8A9B')).toBe(false);
    expect(isCommunityKey('not-a-key')).toBe(false);
    expect(isCommunityKey(null)).toBe(false);
  });
});

describe('COMMUNITY_CATEGORIES', () => {
  it('has unique ids and PascalCase telemetry types', () => {
    const ids = COMMUNITY_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of COMMUNITY_CATEGORIES) expect(c.type).toMatch(/^[A-Z][A-Za-z]+$/);
  });
});
