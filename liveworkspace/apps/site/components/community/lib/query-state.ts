import {
  communityQueryParams,
  EMPTY_COMMUNITY_QUERY,
  isCommunityCategory,
  isCommunityCategoryOf,
  communitySearchCategory,
  communitySearchCategoryFilter,
  communitySearchSort,
  communitySearchTags,
  communitySearchTerms,
  normaliseCommunityTag,
  setCommunitySearchCategory,
  setCommunitySearchMine,
  setCommunitySearchSort,
  parseCommunityListQuery,
  type CommunityApp,
  type CommunityCategoryFilter,
  type CommunityListQuery,
  type CommunityScope,
} from '@liveworkspace/community';

// The gallery's filters as they live in the URL (livediagram/docs/specs/025-community/community.md "Gallery"): `q`
// carries every filter as words (`#tag`, `category:`, `sort:`, `is:mine`), and older `tag`, `category` and `sort`
// parameters fold into it, so a filtered view can be shared and survives a reload. Pure, so
// the round trip is tested (lib/query-state.test.ts). Offsets never reach the URL: Load More pages in
// memory and a fresh load starts at the top.

export type GalleryFilters = Omit<CommunityListQuery, 'offset'>;

export const EMPTY_FILTERS: GalleryFilters = {
  q: EMPTY_COMMUNITY_QUERY.q,
  category: EMPTY_COMMUNITY_QUERY.category,
  categoryApp: EMPTY_COMMUNITY_QUERY.categoryApp,
  tag: EMPTY_COMMUNITY_QUERY.tag,
  sort: EMPTY_COMMUNITY_QUERY.sort,
};

// The category a gallery can place, as it writes it (liveworkspace/docs/specs/007-community/community.md "One page for
// every app"), or null. One app's gallery (`scope` an app) takes its own categories, bare (`category:meetings`); one
// named with its own app (`category:livediagram/meetings`, from All Apps) is the same and reads bare. All Apps (`all`)
// names a category with its app, since ids repeat across apps with different meanings: a bare id there could be any
// app's, so it reads as none, as another app's category does on one app's gallery. With no scope, any valid category
// stands as written (the search box's echo, tidying what was typed).
export function placeCategory(
  category: CommunityCategoryFilter,
  scope?: CommunityScope,
): CommunityCategoryFilter | null {
  if (!scope) return category;
  if (scope === 'all') return category.app ? category : null;
  const app = scope;
  const own = category.app === null || category.app === app;
  return own && isCommunityCategoryOf(app, category.id) ? { app: null, id: category.id } : null;
}

// A stale or hand-edited link still shows something: a category the gallery cannot place, or a tag that does not
// normalise, is dropped on its own rather than discarding the whole query (the api would refuse it as
// `invalid_query`).
export function readQueryState(params: URLSearchParams, scope?: CommunityScope): GalleryFilters {
  const clean = new URLSearchParams(params);
  // An older `?category=` link names a bare id: one app's.
  const rawCategory = clean.get('category');
  clean.delete('category');
  const fromParam =
    rawCategory !== null && isCommunityCategory(rawCategory)
      ? placeCategory({ app: null, id: rawCategory }, scope)
      : null;
  const typed = clean.get('q') ?? '';
  const asked = communitySearchCategoryFilter(typed);
  const placed = asked ? placeCategory(asked, scope) : null;
  // The search's own word, rewritten only when the gallery reads it differently (dropped, or its app left out).
  if (asked && placed?.app !== asked.app) clean.set('q', setCommunitySearchCategory(typed, placed));
  const tag = clean.get('tag');
  if (tag !== null && !normaliseCommunityTag(tag)) clean.delete('tag');
  clean.delete('offset');
  const parsed = parseCommunityListQuery(clean);
  if (!parsed.ok) return EMPTY_FILTERS;
  const { q, tag: t, sort } = parsed.value;
  // Tags, the category and the sort live in the search (`#tag`, `category:<id>`, `sort:<id>`: the controls
  // inside the search box); a `?tag=`, `?category=` or `?sort=` link (an older page) folds into it, so the box shows
  // it and it can be changed like any other.
  const withTag = t && !communitySearchTags(q).includes(t) ? `${q} #${t}`.trim() : q;
  const chosen = asked ? placed : fromParam;
  const withCategory =
    chosen && !communitySearchCategory(withTag)
      ? setCommunitySearchCategory(withTag, chosen)
      : withTag;
  const search = communitySearchSort(withCategory)
    ? withCategory
    : setCommunitySearchSort(withCategory, sort);
  return {
    q: search,
    category: chosen?.id ?? null,
    categoryApp: chosen?.app ?? null,
    tag: null,
    sort,
  };
}

/** Carries the address's search across the switch. Going to All Apps takes My Shares out (it is one app's, on its
 *  address) and names a chosen category with the app (`category:<app>/<id>`), since All Apps lists each app's own;
 *  coming back, the app's own category reads bare again, and another app's is left out (lib/query-state.ts). */
export function carrySearch(search: string, next: 'app' | 'all', app: CommunityApp): string | null {
  const params = new URLSearchParams(search);
  const q = params.get('q') ?? '';
  let moved = next === 'all' ? setCommunitySearchMine(q, false) : q;
  const category = communitySearchCategoryFilter(moved);
  if (next === 'all' && category && category.app === null) {
    const own = isCommunityCategoryOf(app, category.id);
    moved = setCommunitySearchCategory(moved, own ? { app, id: category.id } : null);
  }
  if (next === 'app' && category && category.app !== null) {
    moved = setCommunitySearchCategory(moved, category.app === app ? category.id : null);
  }
  if (moved === q) return null;
  return writeQueryState({ ...readQueryState(params), q: moved });
}

// The search string for these filters, defaults omitted: '' when nothing is set, else `?q=...`.
export function writeQueryState(filters: GalleryFilters): string {
  // The category and sort travel in `q` as words, never as their own parameters.
  const search = communityQueryParams({
    ...filters,
    category: null,
    categoryApp: null,
    sort: 'new',
  }).toString();
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
