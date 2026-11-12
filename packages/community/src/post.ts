import type { CommunityApp } from './apps';
import type { CommunityAuthor } from './authors';
import { isCommunityCategory, isCommunityCategoryOf, type CommunityCategory } from './categories';

// Community (liveworkspace/docs/specs/007-community/community.md; the product spec is livediagram/docs/specs/025-community/community.md):
// the vocabulary, limits, validation and wire shapes shared by liveworkspace's Community service, each app's
// Workers, its editor's publish dialog and its Community pages, so none of them can disagree on what a valid
// post, tag or query is.

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
// The most likes, and copies, one network adds to a post's counts (blueprint §7): enough for an office sharing one
// address range, too few for one person rotating addresses to move the featured six.
export const COMMUNITY_COUNTED_PER_NETWORK = 5;
export const COMMUNITY_POPULAR_TAGS = 24;
export const COMMUNITY_RELATED_POSTS = 6;
export const COMMUNITY_SEARCH_TERMS_MAX = 5;
// The longest search a query keeps (the search box stops there too).
export const COMMUNITY_SEARCH_MAX = 200;
// The landing page's Community section (livediagram/docs/specs/025-community/community.md "Featured on the home page"):
// how many posts, and the window their likes are counted over.
export const COMMUNITY_FEATURED_COUNT = 6;
export const COMMUNITY_FEATURED_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
export const COMMUNITY_SEARCH_TERM_MAX = 40;
// Start With (liveworkspace/docs/specs/007-community/community.md "Start With"): in each app's new-document template
// picker, each category shows up to COMMUNITY_START_PER_CATEGORY posts after its templates, the most liked over the
// last COMMUNITY_START_WINDOW_MS, and only posts with at least COMMUNITY_START_MIN_LIKES likes in that window (owner,
// 2026-11-07), so a tile there is a document people have really taken to.
export const COMMUNITY_START_PER_CATEGORY = 3;
export const COMMUNITY_START_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
export const COMMUNITY_START_MIN_LIKES = 5;

// The header the Community pages' per-browser key travels under (liveworkspace/docs/specs/007-community/community.md "Public routes"; each app keeps it
// under its own storage key). Deliberately not the guest owner id: a like must never put an owner credential on
// the wire.
export const COMMUNITY_KEY_HEADER = 'X-Community-Key';
const COMMUNITY_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isCommunityKey(value: unknown): value is string {
  return typeof value === 'string' && COMMUNITY_KEY_PATTERN.test(value);
}

// ---------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------

// Spec "Tags": lowercased with the locale-free rule (`toLowerCase`, never `toLocaleLowerCase`, so every browser and
// the worker agree), then NFC-normalised so an accent typed as a separate mark joins its letter. Whitespace and
// underscores become one hyphen; letters and digits of any script are kept, with the combining marks that follow
// them (Devanagari's vowel signs, an accent NFC has no single character for); every other character (punctuation,
// symbols, emoji) is dropped; hyphen runs and edge hyphens collapse. Null when the result is outside 2..24 code
// points. One left-to-right pass that tests each code point on its own, so no input can make it backtrack, and it
// stops as soon as the tag is too long. A tag stored under the old a-z 0-9 rule is already in this form.
const TAG_LETTER = /^[\p{L}\p{N}]$/u;
const TAG_MARK = /^\p{M}$/u;
const TAG_SPACE = /^[\s_]$/u;

export function normaliseCommunityTag(raw: string): string | null {
  let tag = '';
  let length = 0;
  // A hyphen waits until a letter follows it, so edge hyphens and runs never land.
  let hyphen = false;
  // Whether the last character kept was a letter, digit or mark: a mark is kept only after one of those.
  let afterLetter = false;
  for (const char of raw.toLowerCase().normalize('NFC')) {
    if (char === '-' || TAG_SPACE.test(char)) {
      hyphen = length > 0;
      afterLetter = false;
      continue;
    }
    if (!TAG_LETTER.test(char) && !(afterLetter && TAG_MARK.test(char))) continue;
    if (hyphen) {
      tag += '-';
      length += 1;
      hyphen = false;
    }
    tag += char;
    length += 1;
    if (length > COMMUNITY_TAG_MAX) return null;
    afterLetter = true;
  }
  return length >= COMMUNITY_TAG_MIN ? tag : null;
}

// ---------------------------------------------------------------------
// Post input
// ---------------------------------------------------------------------

export type CommunityPostInput = {
  title: string;
  description: string;
  category: CommunityCategory;
  tags: string[];
  // Shown as "Anonymous" rather than the author's name and picture (livediagram/docs/specs/025-community/community.md
  // "Publishing"). On unless the author turns it off; an input without it publishes anonymously.
  anonymous: boolean;
};

type CommunityInputError =
  'invalid_title' | 'invalid_description' | 'invalid_category' | 'invalid_tags';

type CommunityInputResult =
  { ok: true; value: CommunityPostInput } | { ok: false; error: CommunityInputError };

// The four fields a post's input has, in the order the publish dialog shows them.
export const COMMUNITY_INPUT_FIELDS = ['title', 'description', 'category', 'tags'] as const;
export type CommunityInputField = (typeof COMMUNITY_INPUT_FIELDS)[number];

const FIELD_ERROR: Record<CommunityInputField, CommunityInputError> = {
  title: 'invalid_title',
  description: 'invalid_description',
  category: 'invalid_category',
  tags: 'invalid_tags',
};

// The field a refusal code is about, or null for one that is not about a field (a worker refusal like
// `empty_document`). Lets the dialog put a worker's field refusal under its field too.
export function communityInputErrorField(
  code: string | null | undefined,
): CommunityInputField | null {
  return COMMUNITY_INPUT_FIELDS.find((f) => FIELD_ERROR[f] === code) ?? null;
}

type Checked = {
  title: string;
  description: string;
  category: CommunityCategory | null;
  tags: string[];
  errors: CommunityInputError[];
};

// Every field checked, every failure kept (in field order), so a form can mark all of them at once.
// Trims the title and description and collapses runs of three or more newlines to two; tags are
// normalised and de-duplicated, and any tag that does not survive normalisation fails the tags field
// rather than vanishing silently.
// With an app, the category must be one of that app's (the service checks it for the app that publishes); without one,
// any app's (a form that only offers its own app's chips).
function checkCommunityPostInput(input: unknown, app?: CommunityApp): Checked {
  const body = (input ?? {}) as Record<string, unknown>;
  const errors: CommunityInputError[] = [];
  const title = typeof body.title === 'string' ? body.title.trim().replace(/\s+/g, ' ') : '';
  if (title.length < COMMUNITY_TITLE_MIN || title.length > COMMUNITY_TITLE_MAX) {
    errors.push('invalid_title');
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
    errors.push('invalid_description');
  }
  const known = app
    ? isCommunityCategoryOf(app, body.category)
    : isCommunityCategory(body.category);
  const category = known ? (body.category as CommunityCategory) : null;
  if (!category) errors.push('invalid_category');
  const tags: string[] = [];
  let tagsOk = Array.isArray(body.tags);
  for (const raw of Array.isArray(body.tags) ? body.tags : []) {
    const tag = typeof raw === 'string' ? normaliseCommunityTag(raw) : null;
    if (!tag) tagsOk = false;
    else if (!tags.includes(tag)) tags.push(tag);
  }
  if (!tagsOk || tags.length > COMMUNITY_TAGS_MAX) errors.push('invalid_tags');
  return { title, description, category, tags, errors };
}

// Every failing field's code, in field order; empty when the input is valid.
export function communityPostInputErrors(
  input: unknown,
  app?: CommunityApp,
): CommunityInputError[] {
  return checkCommunityPostInput(input, app).errors;
}

// What publish and Edit Listing accept (blueprint §4): the normalised input, or the first failing
// field's code (the worker answers one code per request).
export function validateCommunityPostInput(
  input: unknown,
  app?: CommunityApp,
): CommunityInputResult {
  const { title, description, category, tags, errors } = checkCommunityPostInput(input, app);
  if (errors.length > 0 || !category) return { ok: false, error: errors[0] ?? 'invalid_category' };
  const anonymous = (input as { anonymous?: unknown } | null)?.anonymous !== false;
  return { ok: true, value: { title, description, category, tags, anonymous } };
}

// ---------------------------------------------------------------------
// Wire shapes (blueprint §4)
// ---------------------------------------------------------------------

export type CommunityPostState = 'listed' | 'hidden';

export type CommunityPost = {
  id: string;
  // The app the post's document is in: whose gallery lists it, and where its page, viewer and copy open. Every app's
  // gallery shows it under All Apps (liveworkspace/docs/specs/007-community/community.md "One page for every app").
  app: CommunityApp;
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
  // "Anonymous" (COMMUNITY_ANONYMOUS_AUTHOR) when the author chose to share anonymously.
  author: CommunityAuthor;
  anonymous: boolean;
  // Whether the caller's community key likes this post; false without a key.
  liked: boolean;
};

export type CommunityOwnPost = CommunityPost & { state: CommunityPostState };

export type CommunityListResponse = { posts: CommunityPost[]; nextOffset: number | null };
// My Shares (`GET /api/community/mine`): the caller's own posts, hidden ones included, with what only the
// author may see (the state, the document to open), and how popular they are altogether.
export type CommunityMinePost = CommunityOwnPost & { documentId: string };
export type CommunityMineTotals = { posts: number; likes: number; copies: number };
export type CommunityMineResponse = {
  posts: CommunityMinePost[];
  nextOffset: number | null;
  totals: CommunityMineTotals;
};
export type CommunityFacetsResponse = {
  total: number;
  // Posts per category id (for All Apps, the same id's posts in every app together).
  categories: Partial<Record<CommunityCategory, number>>;
  // All Apps only: each app's posts per category, for its category menu, which names each app's own.
  apps?: Partial<Record<CommunityApp, Partial<Record<CommunityCategory, number>>>>;
  tags: { tag: string; count: number }[];
};
export type CommunityPostResponse = { post: CommunityPost; related: CommunityPost[] };
// The Community sitemap's source (livediagram/docs/specs/025-community/community.md "Search engines"): every post the public can
// see, newest first, up to COMMUNITY_SITEMAP_MAX, as just what a sitemap entry needs. `updatedAt` is epoch ms.
export type CommunitySitemapEntry = { id: string; updatedAt: number };
export type CommunitySitemapResponse = { posts: CommunitySitemapEntry[] };
// One sitemap file holds at most 50,000 URLs; this stays far below it so the query and the XML stay small (about
// 0.6 MB at the cap). Past it the oldest posts drop off the sitemap, never out of the Community.
export const COMMUNITY_SITEMAP_MAX = 5000;
export type CommunityFeaturedResponse = { posts: CommunityPost[] };
// A post as a Start With tile: only what the tile shows and opens, so the one answer for every category stays small
// (blueprint "Start With"). `line` is the description's first paragraph, cut to COMMUNITY_START_LINE_MAX at a word.
// `authorName` is "Anonymous" when the author chose it.
export type CommunityStartPost = Pick<
  CommunityPost,
  'id' | 'app' | 'title' | 'category' | 'shareCode' | 'likeCount' | 'copyCount' | 'anonymous'
> & { authorName: string; line: string };

// `GET /start?app=`: Start With's Community tiles, per category of the app, best first. A category with none is
// absent. The same for everyone, and served from the edge.
export type CommunityStartResponse = {
  categories: Partial<Record<CommunityCategory, CommunityStartPost[]>>;
};

// The longest line a Start With tile shows: about two lines of a template tile's description.
export const COMMUNITY_START_LINE_MAX = 120;

// A description as a tile's line: its first paragraph, whitespace collapsed, cut at the last word that fits with an
// ellipsis.
export function communityStartLine(description: string): string {
  const first = (description.split(/\n\s*\n/)[0] ?? '').replace(/\s+/g, ' ').trim();
  if (first.length <= COMMUNITY_START_LINE_MAX) return first;
  const cut = first.slice(0, COMMUNITY_START_LINE_MAX - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > COMMUNITY_START_LINE_MAX / 2 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?-]+$/, '')}…`;
}

// A post as its Start With tile.
export function communityStartPost(post: CommunityPost): CommunityStartPost {
  return {
    id: post.id,
    app: post.app,
    title: post.title,
    category: post.category,
    shareCode: post.shareCode,
    likeCount: post.likeCount,
    copyCount: post.copyCount,
    anonymous: post.anonymous,
    authorName: post.author.name,
    line: communityStartLine(post.description),
  };
}
export type CommunityOwnPostResponse = { post: CommunityOwnPost | null };
export type CommunityLikeResponse = { likeCount: number; liked: boolean };
export type CommunityReportInput = { reason: CommunityReportReason; note?: string | null };

// What the share resolve adds for a community link (spec "Viewing a post's document").
export type CommunityShareInfo = { postId: string; author: CommunityAuthor };
