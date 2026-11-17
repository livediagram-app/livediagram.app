import { isCommunityApp, type CommunityApp } from './apps';

// The Forum (liveworkspace/docs/specs/007-community/community.md "The Forum"): one forum for every app, on the Community
// page beside the gallery. Its categories, reactions, limits, validation and wire shapes, shared by the Community
// service and the page, so neither can disagree on what a valid topic, reply or query is.

// ---------------------------------------------------------------------
// Categories and reactions
// ---------------------------------------------------------------------

/** What kind of post a topic is. Apps are not categories: a topic names its app in its own field (`app`). */
export const FORUM_CATEGORIES = [
  { id: 'question', label: 'Question' },
  { id: 'tips', label: 'Tips & Tricks' },
  { id: 'feature', label: 'Feature Request' },
  { id: 'bug', label: 'Bug Report' },
  { id: 'showcase', label: 'Show & Tell' },
  { id: 'general', label: 'General' },
] as const satisfies readonly { id: string; label: string }[];

export type ForumCategory = (typeof FORUM_CATEGORIES)[number]['id'];

/** The category a new post starts in. */
export const FORUM_START_CATEGORY: ForumCategory = 'question';

const CATEGORY_IDS: ReadonlySet<string> = new Set(FORUM_CATEGORIES.map((c) => c.id));

export function isForumCategory(value: unknown): value is ForumCategory {
  return typeof value === 'string' && CATEGORY_IDS.has(value);
}

export function forumCategoryLabel(id: ForumCategory): string {
  return FORUM_CATEGORIES.find((c) => c.id === id)!.label;
}

/** The app a topic is about, or null for Any App (liveworkspace, or every app). */
export type ForumApp = CommunityApp | null;

export const FORUM_ANY_APP_LABEL = 'Any App';

export function isForumApp(value: unknown): value is ForumApp {
  return value === null || isCommunityApp(value);
}

/** An app's name in words ("livediagram"), or Any App. */
export function forumAppLabel(app: ForumApp): string {
  return app ? app.slice(0, -'.app'.length) : FORUM_ANY_APP_LABEL;
}

export const FORUM_REACTIONS = [
  { id: 'helpful', label: 'Helpful', type: 'Helpful' },
  { id: 'thanks', label: 'Thanks', type: 'Thanks' },
  { id: 'celebrate', label: 'Celebrate', type: 'Celebrate' },
] as const;

export type ForumReaction = (typeof FORUM_REACTIONS)[number]['id'];

const REACTION_IDS: ReadonlySet<string> = new Set(FORUM_REACTIONS.map((r) => r.id));

export function isForumReaction(value: unknown): value is ForumReaction {
  return typeof value === 'string' && REACTION_IDS.has(value);
}

/** Every reaction at zero, in display order. */
export function noForumReactions(): Record<ForumReaction, number> {
  return { helpful: 0, thanks: 0, celebrate: 0 };
}

// ---------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------

export const FORUM_TITLE_MIN = 5;
export const FORUM_TITLE_MAX = 120;
export const FORUM_BODY_MIN = 10;
export const FORUM_BODY_MAX = 5000;
export const FORUM_REPLY_MIN = 2;
export const FORUM_AUTHOR_NAME_MAX = 60;
export const FORUM_PAGE_SIZE = 20;
export const FORUM_MAX_OFFSET = 2000;
// Replies one topic takes; past it a reply answers `409 topic_full`, so a topic's page is one bounded read.
export const FORUM_REPLIES_MAX = 200;
// The list's line under each title.
export const FORUM_EXCERPT_MAX = 160;
// Per account, per clock hour (community.md "Limits per account").
export const FORUM_WRITES_PER_HOUR = 20;
export const FORUM_REACTIONS_PER_HOUR = 200;

// ---------------------------------------------------------------------
// States, sorts and wire shapes
// ---------------------------------------------------------------------

/** `listed`: everyone sees it. `pending`: waiting for the check. `refused`: the check failed. `hidden`: after reports.
 *  Only `listed` is seen by anyone but its author. */
export type ForumPostState = 'listed' | 'pending' | 'refused' | 'hidden';

export const FORUM_SORTS = [
  { id: 'active', label: 'Latest Activity' },
  { id: 'popular', label: 'Popular' },
  { id: 'new', label: 'Newest' },
  { id: 'unanswered', label: 'Unanswered' },
] as const;
export type ForumSort = (typeof FORUM_SORTS)[number]['id'];
/** Popular reads only the topics active in this window, so its ranking stays a bounded scan however old the Forum. */
export const FORUM_POPULAR_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const SORT_IDS: ReadonlySet<string> = new Set(FORUM_SORTS.map((s) => s.id));

/** How an author is shown: a name and a colour, never an id. */
export type ForumAuthor = { name: string; color: string };

export type ForumReactions = {
  counts: Record<ForumReaction, number>;
  /** The reactions the reader gave (none signed out). */
  mine: ForumReaction[];
};

export type ForumTopicSummary = {
  id: string;
  category: ForumCategory;
  app: ForumApp;
  title: string;
  excerpt: string;
  author: ForumAuthor;
  replyCount: number;
  answered: boolean;
  createdAt: number;
  activityAt: number;
  state: ForumPostState;
  own: boolean;
};

export type ForumPost = {
  id: string;
  /** The topic a reply answers; null for a topic. */
  topicId: string | null;
  body: string;
  author: ForumAuthor;
  createdAt: number;
  editedAt: number | null;
  state: ForumPostState;
  own: boolean;
  reactions: ForumReactions;
};

export type ForumTopic = ForumPost & {
  topicId: null;
  category: ForumCategory;
  app: ForumApp;
  title: string;
  /** The reply its author marked, when that reply is listed. */
  answerId: string | null;
};

export type ForumReply = ForumPost & { topicId: string };

export type ForumTopicsResponse = { topics: ForumTopicSummary[]; nextOffset: number | null };
export type ForumTopicResponse = { topic: ForumTopic; replies: ForumReply[] };
export type ForumReactionsResponse = { reactions: ForumReactions };

export type ForumTopicInput = {
  category: ForumCategory;
  app: ForumApp;
  title: string;
  body: string;
};
export type ForumReplyInput = { body: string };
export type ForumEditInput = { title?: string; body: string };

// ---------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------

export type ForumInputError = 'invalid_category' | 'invalid_app' | 'invalid_title' | 'invalid_body';
type Valid<T> = { ok: true; value: T } | { ok: false; error: ForumInputError | 'invalid_author' };

const singleLine = (value: unknown) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

// Trimmed, every line ending `\n`, and no more than one blank line in a row. Each pattern is a single character class
// repeated once, so it runs in one linear pass.
export function normaliseForumText(value: unknown): string {
  return typeof value === 'string'
    ? value
        .trim()
        .replace(/\r\n?/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
    : '';
}

const within = (text: string, min: number, max: number) => text.length >= min && text.length <= max;

export function validateForumTopic(input: unknown): Valid<ForumTopicInput> {
  const body = (input ?? {}) as Record<string, unknown>;
  if (!isForumCategory(body.category)) return { ok: false, error: 'invalid_category' };
  // Absent is Any App, as null is.
  const app = body.app ?? null;
  if (!isForumApp(app)) return { ok: false, error: 'invalid_app' };
  const title = singleLine(body.title);
  if (!within(title, FORUM_TITLE_MIN, FORUM_TITLE_MAX))
    return { ok: false, error: 'invalid_title' };
  const text = normaliseForumText(body.body);
  if (!within(text, FORUM_BODY_MIN, FORUM_BODY_MAX)) return { ok: false, error: 'invalid_body' };
  return { ok: true, value: { category: body.category, app, title, body: text } };
}

export function validateForumReply(input: unknown): Valid<ForumReplyInput> {
  const text = normaliseForumText(((input ?? {}) as Record<string, unknown>).body);
  if (!within(text, FORUM_REPLY_MIN, FORUM_BODY_MAX)) return { ok: false, error: 'invalid_body' };
  return { ok: true, value: { body: text } };
}

/** An edit: a topic's title and body, or a reply's body. */
export function validateForumEdit(input: unknown, isTopic: boolean): Valid<ForumEditInput> {
  const body = (input ?? {}) as Record<string, unknown>;
  if (!isTopic) return validateForumReply(body);
  const title = singleLine(body.title);
  if (!within(title, FORUM_TITLE_MIN, FORUM_TITLE_MAX))
    return { ok: false, error: 'invalid_title' };
  const text = normaliseForumText(body.body);
  if (!within(text, FORUM_BODY_MIN, FORUM_BODY_MAX)) return { ok: false, error: 'invalid_body' };
  return { ok: true, value: { title, body: text } };
}

const COLOR = /^#[0-9a-f]{6}$/i;

// A colour for an author whose account shows Automatic: picked from the account id, so it stays the same.
export const FORUM_AUTHOR_COLORS = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#dc2626',
  '#d97706',
  '#059669',
  '#0891b2',
  '#4f46e5',
] as const;

export function forumFallbackColor(accountId: string): string {
  let hash = 0;
  for (let i = 0; i < accountId.length; i++) hash = (hash * 31 + accountId.charCodeAt(i)) >>> 0;
  return FORUM_AUTHOR_COLORS[hash % FORUM_AUTHOR_COLORS.length]!;
}

/** How the author is shown: a name of 1 to 60 characters, and their colour (one from their id when it isn't
 *  `#rrggbb`). */
export function validateForumAuthor(value: unknown, accountId: string): Valid<ForumAuthor> {
  const author = (value ?? {}) as Record<string, unknown>;
  const name = singleLine(author.name);
  if (!within(name, 1, FORUM_AUTHOR_NAME_MAX)) return { ok: false, error: 'invalid_author' };
  const color =
    typeof author.color === 'string' && COLOR.test(author.color)
      ? author.color.toLowerCase()
      : forumFallbackColor(accountId);
  return { ok: true, value: { name, color } };
}

/** The list's line: the body's first words, on one line, cut at a word near FORUM_EXCERPT_MAX. */
export function forumExcerpt(body: string): string {
  const line = body.replace(/\s+/g, ' ').trim();
  if (line.length <= FORUM_EXCERPT_MAX) return line;
  const cut = line.slice(0, FORUM_EXCERPT_MAX);
  const space = cut.lastIndexOf(' ');
  return `${(space > FORUM_EXCERPT_MAX / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

// ---------------------------------------------------------------------
// The list's query
// ---------------------------------------------------------------------

/** `app`: null for every app. A list of one app's posts names it; there is no filter for Any App posts alone. */
export type ForumListQuery = {
  category: ForumCategory | null;
  app: CommunityApp | null;
  sort: ForumSort;
  offset: number;
};

/** Lenient, as the gallery's: an unknown category or app is every one, an unknown sort `active`, the offset clamped.
 *  An app reads with or without its `.app` (`?app=livediagram`). */
export function parseForumListQuery(params: URLSearchParams): ForumListQuery {
  const category = params.get('category');
  const appParam = params.get('app');
  const app = appParam && !appParam.endsWith('.app') ? `${appParam}.app` : appParam;
  const sort = params.get('sort');
  const offset = Math.floor(Number(params.get('offset') ?? 0));
  return {
    category: isForumCategory(category) ? category : null,
    app: isCommunityApp(app) ? app : null,
    sort: sort && SORT_IDS.has(sort) ? (sort as ForumSort) : 'active',
    offset: Number.isFinite(offset) ? Math.min(Math.max(offset, 0), FORUM_MAX_OFFSET) : 0,
  };
}

export function forumQueryParams(query: Partial<ForumListQuery>): URLSearchParams {
  const params = new URLSearchParams();
  if (query.category) params.set('category', query.category);
  if (query.app) params.set('app', forumAppLabel(query.app));
  if (query.sort && query.sort !== 'active') params.set('sort', query.sort);
  if (query.offset) params.set('offset', String(query.offset));
  return params;
}

// ---------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------

/** The service's Forum, under the Community API. */
export const FORUM_API_PATH = '/forum';
/** The Forum's page, beside the gallery's. */
export const FORUM_HOME_PATH = '/community/forum';

export function forumTopicPath(topicId: string): string {
  return `${FORUM_HOME_PATH}/topic?id=${encodeURIComponent(topicId)}`;
}
