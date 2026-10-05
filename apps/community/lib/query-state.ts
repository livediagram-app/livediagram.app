import {
  communityQueryParams,
  EMPTY_COMMUNITY_QUERY,
  isCommunityCategory,
  communitySearchCategory,
  communitySearchSort,
  communitySearchTags,
  communitySearchTerms,
  normaliseCommunityTag,
  setCommunitySearchCategory,
  setCommunitySearchSort,
  parseCommunityListQuery,
  type CommunityListQuery,
} from '@livediagram/api-schema';

// The gallery's filters as they live in the URL (docs/specs/025-community/community.md "Gallery"): `q`
// carries every filter as words (`#tag`, `category:`, `sort:`, `is:mine`), and older `tag`, `category` and `sort`
// parameters fold into it, so a filtered view can be shared and survives a reload. Pure, so
// the round trip is tested (lib/query-state.test.ts). Offsets never reach the URL: Load More pages in
// memory and a fresh load starts at the top.

export type GalleryFilters = Omit<CommunityListQuery, 'offset'>;

export const EMPTY_FILTERS: GalleryFilters = {
  q: EMPTY_COMMUNITY_QUERY.q,
  category: EMPTY_COMMUNITY_QUERY.category,
  tag: EMPTY_COMMUNITY_QUERY.tag,
  sort: EMPTY_COMMUNITY_QUERY.sort,
};

// A stale or hand-edited link still shows something: an unknown category or a tag that does not
// normalise is dropped on its own rather than discarding the whole query (the api would refuse it as
// `invalid_query`).
export function readQueryState(params: URLSearchParams): GalleryFilters {
  const clean = new URLSearchParams(params);
  const category = clean.get('category');
  if (category !== null && !isCommunityCategory(category)) clean.delete('category');
  const tag = clean.get('tag');
  if (tag !== null && !normaliseCommunityTag(tag)) clean.delete('tag');
  clean.delete('offset');
  const parsed = parseCommunityListQuery(clean);
  if (!parsed.ok) return EMPTY_FILTERS;
  const { q, category: c, tag: t, sort } = parsed.value;
  // Tags, the category and the sort live in the search (`#tag`, `category:<id>`, `sort:<id>`: the controls
  // inside the search box); a `?tag=`, `?category=` or `?sort=` link (an older page) folds into it, so the box shows it and it can be changed
  // like any other.
  const withTag = t && !communitySearchTags(q).includes(t) ? `${q} #${t}`.trim() : q;
  const withCategory =
    c && !communitySearchCategory(withTag) ? setCommunitySearchCategory(withTag, c) : withTag;
  const search = communitySearchSort(withCategory)
    ? withCategory
    : setCommunitySearchSort(withCategory, sort);
  return { q: search, category: c, tag: null, sort };
}

// The search string for these filters, defaults omitted: '' when nothing is set, else `?q=...`.
export function writeQueryState(filters: GalleryFilters): string {
  // The category and sort travel in `q` as words, never as their own parameters.
  const search = communityQueryParams({ ...filters, category: null, sort: 'new' }).toString();
  return search ? `?${search}` : '';
}

// Whether any filter narrows the gallery (the sort only orders it), which decides between the two
// empty states.
export function hasActiveFilters(filters: GalleryFilters): boolean {
  return (
    communitySearchTerms(filters.q).length > 0 ||
    communitySearchTags(filters.q).length > 0 ||
    communitySearchCategory(filters.q) !== null ||
    filters.category !== null ||
    filters.tag !== null
  );
}

// Whether the plain search words differ (and there are some), ignoring the controls' words.
export function searchedWordsChanged(before: string, after: string): boolean {
  const next = communitySearchTerms(after);
  return next.length > 0 && next.join(' ') !== communitySearchTerms(before).join(' ');
}

// What the address hands back for a typed search: the same words, tidied the way the URL round trip tidies them
// (trimmed, a half-typed `sort:` dropped, the default sort left out). The search box uses it to tell the echo of
// its own typing from a change made elsewhere (Clear Filters, a tag link), so it never rewrites what is being typed.
export function searchEcho(q: string): string {
  return readQueryState(new URLSearchParams(writeQueryState({ ...EMPTY_FILTERS, q: q.trim() }))).q;
}
