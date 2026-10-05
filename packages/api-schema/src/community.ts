// Community (docs/specs/025-community/community.md; blueprint docs/specs/025-community/blueprints/community.md):
// the vocabulary, limits, validation and wire shapes shared by the api worker, the editor's publish dialog and the
// Community app, so the three cannot disagree on what a valid post, tag or query is.

// ---------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------

// The closed set, in display order (spec "Categories"). `id` is stored, `label` is shown, `type` is the
// telemetry value (PascalCase, never content).
export const COMMUNITY_CATEGORIES = [
  {
    id: 'architecture',
    label: 'Architecture',
    blurb: 'Systems, cloud, infrastructure, software',
    type: 'Architecture',
  },
  {
    id: 'flows',
    label: 'Flows & Processes',
    blurb: 'Flowcharts, processes, journeys, state',
    type: 'Flows',
  },
  {
    id: 'planning',
    label: 'Planning',
    blurb: 'Roadmaps, kanban, timelines, gantt',
    type: 'Planning',
  },
  {
    id: 'workshops',
    label: 'Workshops',
    blurb: 'Retrospectives, event storming, brainstorming',
    type: 'Workshops',
  },
  {
    id: 'mindmaps',
    label: 'Mind Maps',
    blurb: 'Mind maps, concept maps, notes',
    type: 'Mindmaps',
  },
  {
    id: 'design',
    label: 'Design & Wireframes',
    blurb: 'Wireframes, mockups, layouts',
    type: 'Design',
  },
  {
    id: 'data',
    label: 'Data & Databases',
    blurb: 'Entity diagrams, schemas, tables',
    type: 'Data',
  },
  {
    id: 'learning',
    label: 'Learning & Teaching',
    blurb: 'Explainers, lessons, study notes',
    type: 'Learning',
  },
  {
    id: 'infographics',
    label: 'Infographics',
    blurb: 'Illustrate pages and articles',
    type: 'Infographics',
  },
  { id: 'art', label: 'Drawing & Art', blurb: 'Sketches, illustrations, Draw mode', type: 'Art' },
  { id: 'other', label: 'Something Else', blurb: 'Anything that fits nowhere above', type: 'Other' },
] as const;

export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number]['id'];

const CATEGORY_IDS: ReadonlySet<string> = new Set(COMMUNITY_CATEGORIES.map((c) => c.id));

export function isCommunityCategory(value: unknown): value is CommunityCategory {
  return typeof value === 'string' && CATEGORY_IDS.has(value);
}

export function communityCategoryLabel(id: CommunityCategory): string {
  return COMMUNITY_CATEGORIES.find((c) => c.id === id)!.label;
}

export function communityCategoryType(id: CommunityCategory): string {
  return COMMUNITY_CATEGORIES.find((c) => c.id === id)!.type;
}

// ---------------------------------------------------------------------
// Report reasons
// ---------------------------------------------------------------------

export const COMMUNITY_REPORT_REASONS = [
  { id: 'spam', label: 'Spam', type: 'Spam' },
  { id: 'offensive', label: 'Offensive', type: 'Offensive' },
  { id: 'personal-info', label: 'Personal Information', type: 'PersonalInfo' },
  { id: 'copyright', label: 'Copyright', type: 'Copyright' },
  { id: 'other', label: 'Something Else', type: 'Other' },
] as const;

export type CommunityReportReason = (typeof COMMUNITY_REPORT_REASONS)[number]['id'];

const REASON_IDS: ReadonlySet<string> = new Set(COMMUNITY_REPORT_REASONS.map((r) => r.id));

export function isCommunityReportReason(value: unknown): value is CommunityReportReason {
  return typeof value === 'string' && REASON_IDS.has(value);
}

export function communityReportReasonType(id: CommunityReportReason): string {
  return COMMUNITY_REPORT_REASONS.find((r) => r.id === id)!.type;
}

// ---------------------------------------------------------------------
// Limits (blueprint §2)
// ---------------------------------------------------------------------

export const COMMUNITY_TITLE_MIN = 3;
export const COMMUNITY_TITLE_MAX = 80;
export const COMMUNITY_DESCRIPTION_MIN = 20;
export const COMMUNITY_DESCRIPTION_MAX = 500;
export const COMMUNITY_TAGS_MAX = 5;
export const COMMUNITY_TAG_MIN = 2;
export const COMMUNITY_TAG_MAX = 24;
export const COMMUNITY_REPORT_NOTE_MAX = 300;
export const COMMUNITY_POSTS_PER_AUTHOR = 50;
export const COMMUNITY_PAGE_SIZE = 24;
export const COMMUNITY_MAX_OFFSET = 2400;
export const COMMUNITY_AUTO_HIDE_REPORTERS = 3;
export const COMMUNITY_POPULAR_TAGS = 24;
export const COMMUNITY_RELATED_POSTS = 6;
export const COMMUNITY_SEARCH_TERMS_MAX = 5;
export const COMMUNITY_SEARCH_TERM_MAX = 40;

// The header and storage key the Community app's per-browser key travels under (spec "Likes"). Deliberately not
// the guest owner id: a like must never put an owner credential on the wire.
export const COMMUNITY_KEY_HEADER = 'X-Community-Key';
export const COMMUNITY_KEY_STORAGE = 'livediagram:v2:community-key';
const COMMUNITY_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isCommunityKey(value: unknown): value is string {
  return typeof value === 'string' && COMMUNITY_KEY_PATTERN.test(value);
}

// ---------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------

// Spec "Tags": trimmed, lowercased, whitespace and underscores become one hyphen, anything outside a-z 0-9 - is
// dropped, hyphen runs and edge hyphens collapse. Null when the result is outside 2..24 characters.
export function normaliseCommunityTag(raw: string): string | null {
  const tag = raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return tag.length >= COMMUNITY_TAG_MIN && tag.length <= COMMUNITY_TAG_MAX ? tag : null;
}

// ---------------------------------------------------------------------
// Post input
// ---------------------------------------------------------------------

export type CommunityPostInput = {
  title: string;
  description: string;
  category: CommunityCategory;
  tags: string[];
};

export type CommunityInputError =
  | 'invalid_title'
  | 'invalid_description'
  | 'invalid_category'
  | 'invalid_tags';

export type CommunityInputResult =
  | { ok: true; value: CommunityPostInput }
  | { ok: false; error: CommunityInputError };

// What publish and Edit Listing accept (blueprint §4). Trims the title and description and collapses runs of three
// or more newlines to two; tags are normalised and de-duplicated, and any tag that does not survive normalisation
// rejects the whole input rather than vanishing silently.
export function validateCommunityPostInput(input: unknown): CommunityInputResult {
  const body = (input ?? {}) as Record<string, unknown>;
  const title = typeof body.title === 'string' ? body.title.trim().replace(/\s+/g, ' ') : '';
  if (title.length < COMMUNITY_TITLE_MIN || title.length > COMMUNITY_TITLE_MAX) {
    return { ok: false, error: 'invalid_title' };
  }
  const description =
    typeof body.description === 'string'
      ? body.description
          .trim()
          .replace(/\r\n?/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
      : '';
  if (
    description.length < COMMUNITY_DESCRIPTION_MIN ||
    description.length > COMMUNITY_DESCRIPTION_MAX
  ) {
    return { ok: false, error: 'invalid_description' };
  }
  if (!isCommunityCategory(body.category)) return { ok: false, error: 'invalid_category' };
  if (!Array.isArray(body.tags)) return { ok: false, error: 'invalid_tags' };
  const tags: string[] = [];
  for (const raw of body.tags) {
    if (typeof raw !== 'string') return { ok: false, error: 'invalid_tags' };
    const tag = normaliseCommunityTag(raw);
    if (!tag) return { ok: false, error: 'invalid_tags' };
    if (!tags.includes(tag)) tags.push(tag);
  }
  if (tags.length > COMMUNITY_TAGS_MAX) return { ok: false, error: 'invalid_tags' };
  return { ok: true, value: { title, description, category: body.category, tags } };
}

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

// The search terms a query string matches on (blueprint D5): lowercased, whitespace-split, de-duplicated, each cut
// to COMMUNITY_SEARCH_TERM_MAX, at most COMMUNITY_SEARCH_TERMS_MAX of them.
export function communitySearchTerms(q: string): string[] {
  const terms: string[] = [];
  for (const raw of q.toLowerCase().split(/\s+/)) {
    const term = raw.slice(0, COMMUNITY_SEARCH_TERM_MAX);
    if (term && !terms.includes(term)) terms.push(term);
    if (terms.length === COMMUNITY_SEARCH_TERMS_MAX) break;
  }
  return terms;
}

// Parse a list query from URL parameters. Lenient where a stale or hand-edited link should still show something
// (unknown sort, bad offset), strict where it would silently show the wrong thing (unknown category, bad tag).
export function parseCommunityListQuery(
  params: URLSearchParams,
): { ok: true; value: CommunityListQuery } | { ok: false } {
  const q = (params.get('q') ?? '').trim().slice(0, 200);
  const rawCategory = params.get('category');
  if (rawCategory && !isCommunityCategory(rawCategory)) return { ok: false };
  const rawTag = params.get('tag');
  const tag = rawTag ? normaliseCommunityTag(rawTag) : null;
  if (rawTag && !tag) return { ok: false };
  const rawSort = params.get('sort');
  const sort = isCommunitySort(rawSort) ? rawSort : 'new';
  const rawOffset = Number.parseInt(params.get('offset') ?? '0', 10);
  const offset = Number.isFinite(rawOffset)
    ? Math.min(Math.max(rawOffset, 0), COMMUNITY_MAX_OFFSET)
    : 0;
  return {
    ok: true,
    value: {
      q,
      category: (rawCategory as CommunityCategory | null) ?? null,
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

// ---------------------------------------------------------------------
// Wire shapes (blueprint §4)
// ---------------------------------------------------------------------

export type CommunityPostState = 'listed' | 'hidden';
export type CommunityHiddenBy = 'reports' | 'operator';

export type CommunityAuthor = { name: string; color: string; picture: string | null };

export type CommunityPost = {
  id: string;
  title: string;
  description: string;
  category: CommunityCategory;
  tags: string[];
  likeCount: number;
  copyCount: number;
  publishedAt: number;
  updatedAt: number;
  // The community link's code: the card image (`/api/share/<code>/image.svg`), the read-only viewer and the embed
  // all open through it.
  shareCode: string;
  author: CommunityAuthor;
  // Whether the caller's community key likes this post; false without a key.
  liked: boolean;
};

export type CommunityOwnPost = CommunityPost & { state: CommunityPostState };

export type CommunityReport = {
  reason: CommunityReportReason;
  note: string | null;
  createdAt: number;
};

export type CommunityModerationItem = CommunityPost & {
  state: CommunityPostState;
  hiddenBy: CommunityHiddenBy | null;
  reports: CommunityReport[];
};

export type CommunityListResponse = { posts: CommunityPost[]; nextOffset: number | null };
export type CommunityFacetsResponse = {
  total: number;
  categories: Partial<Record<CommunityCategory, number>>;
  tags: { tag: string; count: number }[];
};
export type CommunityPostResponse = { post: CommunityPost; related: CommunityPost[] };
export type CommunityOwnPostResponse = { post: CommunityOwnPost | null };
export type CommunityLikeResponse = { likeCount: number; liked: boolean };
export type CommunityModerationResponse = { items: CommunityModerationItem[] };
export type CommunityReportInput = { reason: CommunityReportReason; note?: string | null };

// What the share resolve adds for a community link (spec "Viewing a post's document").
export type CommunityShareInfo = { postId: string; author: CommunityAuthor };

// The author shown when a post's author has no participant row (blueprint §6).
export const COMMUNITY_UNKNOWN_AUTHOR: CommunityAuthor = {
  name: 'Someone',
  color: '#64748b',
  picture: null,
};

// The live image a card shows, relative to the api base.
export function communityImagePath(shareCode: string): string {
  return `/share/${encodeURIComponent(shareCode)}/image.svg`;
}
