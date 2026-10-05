import {
  communityQueryParams,
  EMPTY_COMMUNITY_QUERY,
  isCommunityCategory,
  normaliseCommunityTag,
  parseCommunityListQuery,
  type CommunityListQuery,
} from '@livediagram/api-schema';

// The gallery's filters as they live in the URL (docs/specs/025-community/community.md "Gallery":
// `q`, `category`, `tag`, `sort`), so a filtered view can be shared and survives a reload. Pure, so
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
  return { q, category: c, tag: t, sort };
}

// The search string for these filters, defaults omitted: '' when nothing is set, else `?q=...`.
export function writeQueryState(filters: GalleryFilters): string {
  const search = communityQueryParams(filters).toString();
  return search ? `?${search}` : '';
}

// Whether any filter narrows the gallery (the sort only orders it), which decides between the two
// empty states.
export function hasActiveFilters(filters: GalleryFilters): boolean {
  return filters.q !== '' || filters.category !== null || filters.tag !== null;
}
