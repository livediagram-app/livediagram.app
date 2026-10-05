// The Community's search grammar and list query (docs/specs/025-community/community.md "Gallery", "My Shares"): the
// sorts, the list query and its URL form, and the words a search carries (`#tag`, `category:<id>`, `sort:<id>`,
// `is:mine` and plain terms). Pure, shared by the api (parsing a request) and the Community app (the search box and
// the address bar). Split from community.ts, which holds the post itself, its input and its wire shapes.

import {
  COMMUNITY_MAX_OFFSET,
  COMMUNITY_SEARCH_MAX,
  COMMUNITY_SEARCH_TERMS_MAX,
  COMMUNITY_SEARCH_TERM_MAX,
  COMMUNITY_TAGS_MAX,
  isCommunityCategory,
  normaliseCommunityTag,
  type CommunityCategory,
} from './community';

// ---------------------------------------------------------------------
// List query
// ---------------------------------------------------------------------

export const COMMUNITY_SORTS = [
  { id: 'new', label: 'Newest', type: 'New' },
  { id: 'loved', label: 'Most Loved', type: 'Loved' },
  { id: 'copied', label: 'Most Copied', type: 'Copied' },
] as const;

export type CommunitySort = (typeof COMMUNITY_SORTS)[number]['id'];

export function isCommunitySort(value: unknown): value is CommunitySort {
  return COMMUNITY_SORTS.some((s) => s.id === value);
}

export type CommunityListQuery = {
  q: string;
  category: CommunityCategory | null;
  tag: string | null;
  sort: CommunitySort;
  offset: number;
};

export const EMPTY_COMMUNITY_QUERY: CommunityListQuery = {
  q: '',
  category: null,
  tag: null,
  sort: 'new',
  offset: 0,
};

// A search string carries every filter in words (docs/specs/025-community/community.md "Gallery"): `#tag`
// tokens, each a tag the post must have; one `category:<id>` token; one `sort:<id>` token (`sort:loved`,
// `sort:copied`; Newest needs none); `is:mine`, for only the caller's own posts (My Shares, signed in); and
// plain terms matched against the title, description and tags.

const isTagToken = (word: string) => word.startsWith('#');
const SORT_PREFIX = 'sort:';
const isSortToken = (word: string) => word.toLowerCase().startsWith(SORT_PREFIX);
const CATEGORY_PREFIX = 'category:';
const isCategoryToken = (word: string) => word.toLowerCase().startsWith(CATEGORY_PREFIX);
export const COMMUNITY_MINE_TOKEN = 'is:mine';
const isMineToken = (word: string) => word.toLowerCase() === COMMUNITY_MINE_TOKEN;

// The plain search terms (blueprint C5): lowercased, whitespace-split, `#tag`, `category:` and `sort:` tokens
// left out,
// de-duplicated, each cut to COMMUNITY_SEARCH_TERM_MAX, at most COMMUNITY_SEARCH_TERMS_MAX of them.
export function communitySearchTerms(q: string): string[] {
  const terms: string[] = [];
  for (const raw of q.toLowerCase().split(/\s+/)) {
    if (isTagToken(raw) || isSortToken(raw) || isCategoryToken(raw) || isMineToken(raw)) continue;
    const term = raw.slice(0, COMMUNITY_SEARCH_TERM_MAX);
    if (term && !terms.includes(term)) terms.push(term);
    if (terms.length === COMMUNITY_SEARCH_TERMS_MAX) break;
  }
  return terms;
}

// The `#tag` tokens, normalised like stored tags, de-duplicated, at most COMMUNITY_TAGS_MAX (a post has
// no more, so more could never match). A token that does not normalise (`#`, `#!`) is ignored.
export function communitySearchTags(q: string): string[] {
  const tags: string[] = [];
  for (const raw of q.split(/\s+/)) {
    if (!isTagToken(raw)) continue;
    const tag = normaliseCommunityTag(raw.slice(1));
    if (tag && !tags.includes(tag)) tags.push(tag);
    if (tags.length === COMMUNITY_TAGS_MAX) break;
  }
  return tags;
}

// Add or remove one `#tag` token in a search string, leaving the rest of what was typed alone.
export function toggleCommunitySearchTag(q: string, tag: string): string {
  const words = q.split(/\s+/).filter(Boolean);
  const isThis = (w: string) => isTagToken(w) && normaliseCommunityTag(w.slice(1)) === tag;
  const next = words.some(isThis) ? words.filter((w) => !isThis(w)) : [...words, `#${tag}`];
  return next.join(' ');
}

// The sort a search string asks for: its last valid `sort:<id>` token, or null when it names none.
export function communitySearchSort(q: string): CommunitySort | null {
  let sort: CommunitySort | null = null;
  for (const raw of q.split(/\s+/)) {
    if (!isSortToken(raw)) continue;
    const id = raw.slice(SORT_PREFIX.length).toLowerCase();
    if (isCommunitySort(id)) sort = id;
  }
  return sort;
}

// The search string with its sort set to `sort`: any `sort:` token removed, and one added at the end
// unless it is the default (Newest), leaving the rest of what was typed alone.
export function setCommunitySearchSort(q: string, sort: CommunitySort): string {
  const words = q.split(/\s+/).filter((w) => w && !isSortToken(w));
  return (sort === 'new' ? words : [...words, `${SORT_PREFIX}${sort}`]).join(' ');
}

// The category a search string asks for: its last valid `category:<id>` token, or null.
export function communitySearchCategory(q: string): CommunityCategory | null {
  let category: CommunityCategory | null = null;
  for (const raw of q.split(/\s+/)) {
    if (!isCategoryToken(raw)) continue;
    const id = raw.slice(CATEGORY_PREFIX.length).toLowerCase();
    if (isCommunityCategory(id)) category = id;
  }
  return category;
}

// The search string with its category set (null for All): any `category:` token removed, and one added
// at the end for a category, leaving the rest of what was typed alone.
export function setCommunitySearchCategory(q: string, category: CommunityCategory | null): string {
  const words = q.split(/\s+/).filter((w) => w && !isCategoryToken(w));
  return (category ? [...words, `${CATEGORY_PREFIX}${category}`] : words).join(' ');
}

// Whether a search string asks for the caller's own posts (My Shares).
export function communitySearchMine(q: string): boolean {
  return q.split(/\s+/).some(isMineToken);
}

// The search string with My Shares on or off: `is:mine` removed, and put first when on, leaving the rest of
// what was typed alone.
export function setCommunitySearchMine(q: string, mine: boolean): string {
  const words = q.split(/\s+/).filter((w) => w && !isMineToken(w));
  return (mine ? [COMMUNITY_MINE_TOKEN, ...words] : words).join(' ');
}

// Parse a list query from URL parameters. Lenient where a stale or hand-edited link should still show something
// (unknown sort, bad offset), strict where it would silently show the wrong thing (unknown category, bad tag).
export function parseCommunityListQuery(
  params: URLSearchParams,
): { ok: true; value: CommunityListQuery } | { ok: false } {
  const q = (params.get('q') ?? '').trim().slice(0, COMMUNITY_SEARCH_MAX);
  const rawCategory = params.get('category');
  if (rawCategory && !isCommunityCategory(rawCategory)) return { ok: false };
  const rawTag = params.get('tag');
  const tag = rawTag ? normaliseCommunityTag(rawTag) : null;
  if (rawTag && !tag) return { ok: false };
  const rawSort = params.get('sort');
  const sort = communitySearchSort(q) ?? (isCommunitySort(rawSort) ? rawSort : 'new');
  const rawOffset = Number.parseInt(params.get('offset') ?? '0', 10);
  const offset = Number.isFinite(rawOffset)
    ? Math.min(Math.max(rawOffset, 0), COMMUNITY_MAX_OFFSET)
    : 0;
  return {
    ok: true,
    value: {
      q,
      category: communitySearchCategory(q) ?? (rawCategory as CommunityCategory | null) ?? null,
      tag,
      sort,
      offset,
    },
  };
}

// The inverse, omitting defaults so URLs stay short. `offset` is never written: the gallery always starts at the
// top of a filter, and Load More pages in memory.
export function communityQueryParams(
  query: Omit<CommunityListQuery, 'offset'> & { offset?: number },
): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.category) params.set('category', query.category);
  if (query.tag) params.set('tag', query.tag);
  if (query.sort !== 'new') params.set('sort', query.sort);
  if (query.offset) params.set('offset', String(query.offset));
  return params;
}
