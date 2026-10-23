// The index's fixed names and numbers (liveworkspace/docs/one-explorer-contracts.md). Both sides read
// these, so the Explorer, the apps and the index can never disagree on a limit.

// The four apps, and the one kind of item each makes: the word people see.
export const APPS = ['livediagram', 'liveplanner', 'livedocuments', 'livedesign'] as const;
export type App = (typeof APPS)[number];

export const KINDS = ['canvas', 'plan', 'document', 'design'] as const;
export type Kind = (typeof KINDS)[number];

export const APP_KINDS: Record<App, Kind> = {
  livediagram: 'canvas',
  liveplanner: 'plan',
  livedocuments: 'document',
  livedesign: 'design',
};

export const isApp = (value: unknown): value is App =>
  typeof value === 'string' && (APPS as readonly string[]).includes(value);

// view < participate < edit.
export const LEVELS = ['view', 'participate', 'edit'] as const;
export type Level = (typeof LEVELS)[number];

export const isLevel = (value: unknown): value is Level =>
  typeof value === 'string' && (LEVELS as readonly string[]).includes(value);

// Whether `have` is at least `need`.
export const levelAtLeast = (have: Level, need: Level): boolean =>
  LEVELS.indexOf(have) >= LEVELS.indexOf(need);

// A folder card's look inside (`GET /folders/previews`): this many folders a request, this many of each one's
// newest items, and its count stops here (the card says "1000+").
export const FOLDER_PREVIEW_IDS_MAX = 60;
export const FOLDER_PREVIEW_ITEMS = 4;
export const FOLDER_PREVIEW_COUNT_CAP = 1000;

// Where the index lives. Each app's router forwards `/api/index/*` on its own origin here, so a browser
// calls its own origin.
export const INDEX_API_PATH = '/api/index';
export const INDEX_API_URL = `https://liveworkspace.app${INDEX_API_PATH}`;

// An app's server names itself here and carries its key as `Authorization: Bearer <key>`.
export const INDEX_APP_HEADER = 'X-Index-App';
// An app's server acting for an account it has already checked (an API token's, say): the account's id,
// and the teams it has joined, comma-separated. Only with the app's key, only for that app's items.
export const INDEX_PERSON_HEADER = 'X-Index-Person';
export const INDEX_TEAMS_HEADER = 'X-Index-Teams';
export const DELEGATED_TEAMS_MAX = 50;
// A link visitor's share code, and its password when the item has one.
export const SHARE_CODE_HEADER = 'X-Share-Code';
export const SHARE_PASSWORD_HEADER = 'X-Share-Password';

// A grant lasts ten minutes; the editor asks for a fresh one a minute before it runs out.
export const GRANT_LIFETIME_S = 600;
export const GRANT_RENEW_BEFORE_S = 60;
export const GRANT_ALG = 'ES256';
// The grant issuer is `${liveworkspace origin}${INDEX_API_PATH}`; production's:
export const GRANT_ISSUER = INDEX_API_URL;
export const GRANT_JWKS_URL = `${INDEX_API_URL}/jwks`;

// Lists are paged.
export const LIST_LIMIT_DEFAULT = 50;
export const LIST_LIMIT_MAX = 200;

// An item's pushed summary, as JSON.
export const SUMMARY_MAX_BYTES = 2048;
// What one tab may push to the Inbox at once.
export const COLLAB_MAX_THREADS = 500;
export const COLLAB_MAX_ACTIONS = 500;

export const TITLE_MAX = 500;
export const FOLDER_NAME_MAX = 500;
export const TAG_NAME_MAX = 32;
export const TAG_LIMIT = 100;
export const SHARE_PASSWORD_MAX = 256;
// Live and lapsed links together, per item.
export const SHARE_LINKS_PER_ITEM = 100;
export const SEARCH_MAX = 200;

// Items stay in the Trash this long before the daily sweep purges them.
export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
// Opens are recorded at most once a minute per person and item.
export const OPEN_DEBOUNCE_MS = 60 * 1000;
// Most Used counts the distinct UTC days a person opened an item over this window; older days are pruned.
export const USE_WINDOW_DAYS = 90;
// How many Most Used items one Recent request may ask for alongside its page (`used`).
export const MOST_USED_MAX = 8;

// The Timeline (liveworkspace/docs/one-explorer-contracts.md "Timeline"). The index records the first eight
// itself; an app reports the rest from its server, in batches (APP_TIMELINE_EVENT_TYPES).
export const TIMELINE_EVENT_TYPES = [
  'created',
  'renamed',
  'moved',
  'trashed',
  'restored',
  'shared',
  'unshared',
  'favourited',
  'edited',
] as const;
export type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number];
// What an app may report. `edited` is one event per person, item and UTC day, its time moving on with each
// report, and counts that day towards the person's Most Used.
export const APP_TIMELINE_EVENT_TYPES = ['edited'] as const;
export type AppTimelineEventType = (typeof APP_TIMELINE_EVENT_TYPES)[number];
// One Timeline page: this many by default, at most TIMELINE_LIMIT_MAX.
export const TIMELINE_PAGE = 30;
export const TIMELINE_LIMIT_MAX = 100;
// Events one app report may carry.
export const APP_EVENTS_MAX = 100;
// Remove from Timeline: at most this many events in one call (a day's stack at most).
export const TIMELINE_DISMISS_MAX = 100;
// The sidebar's Timeline count stops here and reads "99+".
export const TIMELINE_NEW_CAP = 99;

// Share links, as the apps have them today: a lifetime chosen when made, `never` by default.
export const SHARE_LINK_EXPIRIES = ['never', 'week', 'month', 'sixMonths'] as const;
export type ShareLinkExpiry = (typeof SHARE_LINK_EXPIRIES)[number];
export const SHARE_LINK_EXPIRY_MS: Record<Exclude<ShareLinkExpiry, 'never'>, number> = {
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  sixMonths: 183 * 24 * 60 * 60 * 1000,
};
// A link made without a level grants this.
export const DEFAULT_LINK_LEVEL: Level = 'edit';

// A tag's colour: a standard colour's name, drawn per appearance, or a custom `#rrggbb`.
export const TAG_COLOURS = [
  'ink',
  'grey',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'violet',
  'pink',
] as const;
export const isTagColour = (value: unknown): value is string =>
  typeof value === 'string' &&
  ((TAG_COLOURS as readonly string[]).includes(value) || /^#[0-9a-f]{6}$/i.test(value));

export const ITEM_SOURCES = ['person', 'ai', 'import', 'template'] as const;
export type ItemSource = (typeof ITEM_SOURCES)[number];

export const ITEM_VIEWS = ['all', 'recent', 'favourites', 'shared', 'trash', 'unsorted'] as const;
export type ItemView = (typeof ITEM_VIEWS)[number];

// Every `{ "error": "<code>" }` the index answers with.
export const INDEX_ERRORS = [
  'unauthorized',
  'forbidden',
  'not_found',
  'invalid_body',
  'invalid_query',
  'invalid_cursor',
  'invalid_app',
  'invalid_title',
  'invalid_name',
  'invalid_folder',
  'invalid_team',
  'invalid_level',
  'invalid_tab',
  'invalid_tag',
  'invalid_key',
  'invalid_summary',
  'invalid_collab',
  'invalid_events',
  'invalid_password',
  'not_team_member',
  'folder_exists',
  'item_exists',
  'folder_not_found',
  'cycle',
  'tag_name_taken',
  'tag_limit',
  'password_required',
  'password_invalid',
  'never_expires',
  'share_link_limit',
  'wrong_app',
  'copy_failed',
  'grants_unavailable',
] as const;
export type IndexErrorCode = (typeof INDEX_ERRORS)[number];
