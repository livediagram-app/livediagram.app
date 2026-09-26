// Telemetry wire-format (docs/specs/017-telemetry/telemetry.md): the closed category/action vocabulary,
// the TelemetryEvent shape + validator, and the dashboard summary/window
// types. Self-contained (no diagram deps); split out of the schema barrel.

// ---------------------------------------------------------------------
// Telemetry (docs/specs/017-telemetry/telemetry.md)
// ---------------------------------------------------------------------
//
// Anonymous, first-party product events. Each event is three small
// fields: a `category` (the parent: Diagram, Element, …), an `action`
// (the verb: Created, Added, …), and an optional `type` (one
// app-defined reference value: 'Square', 'Edit', a template id …).
// NEVER carries user-generated content — no names, ids, or element
// text. Shared here so the live editor's emitter and the api worker's
// ingest validator use exactly one definition (and the public
// dashboard can only ever surface values from this closed vocabulary).

import { isValidPageViewPath } from './page-views';

export const TELEMETRY_CATEGORIES = [
  'Diagram',
  'Element',
  'Tab',
  'Theme',
  'Canvas',
  'Template',
  'Comment',
  'Note',
  // Assigned actions (docs/specs/012-collaboration/assigned-actions.md): assign / complete / reopen / edit / delete
  // on an element's action, plus the popover open. `type` carries the
  // email-checkbox state on create ('EmailOn'/'EmailOff') and the edit
  // flavour on change ('Reassigned'/'Edited') — never action content.
  'Action',
  'Search',
  'UI',
  'Folder',
  // Layers (docs/specs/006-diagram/layers.md): panel + layer lifecycle. 'Added'/'Deleted'/'Renamed'/
  // 'Reordered' for the layer rows, 'Toggled' with `type`
  // 'Hidden'/'Shown'/'Locked'/'Unlocked' for the eye + padlock,
  // 'Selected' for an active-layer switch, 'Moved' for move-selection-
  // to-layer, 'Opened' for the panel. Never layer names in `type`.
  'Layer',
  'Session',
  // The facilitator baton (docs/specs/012-collaboration/facilitator.md): who is running a live session.
  // 'Started' when somebody takes a free one, 'Changed' when it is handed on
  // or taken back, 'Ended' when the holder steps down. `type` is the shape of
  // the move ('Claimed' / 'Granted' / 'Released'), or 'Unlocked' when the
  // facilitator frees an element somebody was holding (docs/specs/007-editor/live-app.md lock) — never a
  // name: the question is whether rooms use the role at all, not who held it.
  'Facilitator',
  'AI',
  'Team',
  // Participant lifecycle (docs/specs/017-telemetry/telemetry.md): 'Participant'/'Created' fires
  // once per fresh browser identity mint, the daily-new-visitors
  // signal; 'Participant'/'Returned' fires once per browser per UTC
  // day when a returning visitor reopens the app, split guest vs
  // signed-in via the type. Sign-in / sign-up / sign-out stay under
  // 'Session'.
  'Participant',
  // Help centre (apps/help, docs/specs/017-telemetry/telemetry.md + docs/specs/018-help/help-app.md): article views +
  // per-article helpful / not-really feedback. The second app (besides
  // the editor) that emits telemetry. `type` is the article slug.
  'Help',
  // API tokens (docs/specs/015-api/public-api-and-tokens.md) + MCP connections (docs/specs/015-api/mcp-server.md): 'Created'/'Removed'
  // with `type` 'Manual' (Explorer New-token) or 'MCP' (an AI tool connected
  // via the consent screen, which mints a token under the hood).
  'Token',
  // MCP server tool calls (apps/mcp, docs/specs/015-api/mcp-server.md): 'Used' with `type` the tool
  // name (CreateDiagram, ReadDiagram, ...). Emitted by the MCP worker, the
  // third app that reports telemetry, so usage shows up distinctly from the
  // in-editor AI panel.
  'Mcp',
  // Transactional + lifecycle email (apps/api, docs/specs/014-identity/transactional-email.md): 'Sent' with `type`
  // the template kind ('Welcome', 'TeamInvite', ...). Written server-side by
  // the api worker, which is the only place that knows a send happened —
  // nothing reaches a browser, so without this the whole onboarding series
  // was unmeasurable and a broken RESEND_API_KEY was invisible. Never an
  // address, a name, or a count of recipients: the kind and nothing else.
  'Email',
  // Error tracking (docs/specs/017-telemetry/telemetry.md): generic failure counts. The action slot
  // carries the SOURCE ('Api' | 'Client', or 'Warning' for a degradation
  // the author was carried through — deliberate nouns in the verb slot);
  // `type` is a fixed kind or status token ('Http500', 'Internal',
  // 'Uncaught', 'UnhandledRejection', 'AiQuota.BrowserReader') — never a
  // message, stack, or URL.
  'Error',
  // Timeline (docs/specs/013-workspace/timeline.md): the Explorer's landing feed. 'Opened' with
  // `type` 'Landing' | 'Nav' separates the new default landing view
  // from a deliberate visit, so the landing-page change is measurable;
  // 'Opened'/'Stack' counts stacked-run expansions, which is how we
  // learn whether the stacking thresholds are right. 'Changed' carries
  // the view mode, 'Selected' a filter chip's source type, and 'Loaded'
  // 'More' | 'Retry' — the second being a read that failed hard enough
  // that the reader pressed Try again (docs/specs/013-workspace/timeline.md §2.4), which is the
  // only signal we get for a feed nobody could load. Never a diagram
  // name, team name, or comment text.
  'Timeline',
  // Activity page (docs/specs/013-workspace/activity-page.md): the Explorer's cross-diagram inbox of open
  // actions + comment threads. 'Opened' once per visit; 'Selected' with
  // `type` 'Action' | 'Thread' on a row click (which kind of row sends
  // people back into a diagram); 'Loaded'/'Retry' when a failed read is
  // retried. Never an action name, comment text, or diagram name.
  'Activity',
  // Page views (docs/specs/017-telemetry/page-view-telemetry.md): 'View' with `type` the normalised page path
  // ('/help/canvas/the-canvas', '/diagram'), reported by every
  // frontend on each path change. The one category whose `type` is a path,
  // so it validates against PAGE_VIEW_PATH_PATTERN instead of the token
  // pattern, and only ever pairs with 'View'.
  'Page',
] as const;
export type TelemetryCategory = (typeof TELEMETRY_CATEGORIES)[number];

export const TELEMETRY_ACTIONS = [
  'Created',
  'Deleted',
  'Added',
  'Removed',
  'Shared',
  'Joined',
  // Team invites (docs/specs/013-workspace/teams.md): the recipient turned one down. The counterpart to
  // 'Joined' rather than a flavour of 'Removed', because the two answer
  // different questions — an admin withdrawing an invitation is a change of
  // mind about the invite, a recipient declining is an answer to it, and only
  // the accepted-vs-declined pair says whether invitations are landing.
  'Declined',
  'Used',
  'Changed',
  'Exported',
  'Locked',
  'Unlocked',
  // HISTORICAL: the editor stopped emitting these when groups were removed
  // (docs/specs/009-elements/web-components-and-no-groups.md). They stay in the vocabulary so the rows already stored keep
  // their label on the dashboard.
  'Grouped',
  'Ungrouped',
  'Duplicated',
  'Renamed',
  'Reordered',
  'Linked',
  'Unlinked',
  'Resolved',
  'Unresolved',
  'Imported',
  'Aligned',
  'Undone',
  'Redone',
  'Cleared',
  // Diagram / Tab (docs/specs/017-telemetry/telemetry.md): an existing diagram was opened, or a tab's
  // content was fetched for viewing (incl. switching to it). Fires on
  // every open, the counterpart to 'Created' — an engagement/opens signal.
  'Loaded',
  'Opened',
  'Searched',
  'Selected',
  'Toggled',
  'Zoomed',
  'Moved',
  'Closed',
  'Copied',
  'Reverted',
  'SignedIn',
  'SignedUp',
  'SignedOut',
  // Live session tools (docs/specs/012-collaboration/session-tools.md): a timer / vote started or ended, vote
  // results revealed, and a dot cast on an element.
  'Started',
  'Ended',
  'Revealed',
  'Voted',
  // Help centre (docs/specs/017-telemetry/telemetry.md + docs/specs/018-help/help-app.md): an article was viewed, and the
  // reader rated it helpful / not-really via the article feedback widget.
  'View',
  'Helpful',
  'Unhelpful',
  // Participant (docs/specs/017-telemetry/telemetry.md): a returning browser reopened the app on a
  // later UTC day. Paired with 'Participant'/'Created', gated once per
  // UTC day client-side; type is 'Anonymous' | 'Authenticated'.
  'Returned',
  // Email (docs/specs/014-identity/transactional-email.md): a transactional / lifecycle email left the worker for
  // the provider. Only ever paired with the 'Email' category.
  'Sent',
  // Error source (docs/specs/017-telemetry/telemetry.md): the nouns the 'Error' category uses in the
  // action slot — API failures vs client-side exceptions, and warnings: a
  // degradation the author was carried through (a spent AI budget that
  // failed over to the in-browser reader) rather than stopped by.
  'Api',
  'Client',
  'Warning',
] as const;
export type TelemetryAction = (typeof TELEMETRY_ACTIONS)[number];

export type TelemetryEvent = {
  category: TelemetryCategory;
  action: TelemetryAction;
  // One short, app-defined reference token (a shape kind, a share
  // role like 'Edit', an export format, a template id, a theme name).
  // Optional. Bounded by TELEMETRY_TYPE_PATTERN below so the public
  // dashboard can never render user-generated content even if a caller
  // misuses it.
  type?: string | null;
};

// Defence-in-depth bound on `type`: a short token of safe characters,
// not a fixed enum (so adding a new shape / template / theme doesn't
// touch this file). Rejects anything that looks like free text / UGC.
export const TELEMETRY_TYPE_PATTERN = /^[A-Za-z0-9 ._-]{1,40}$/;

// Validate one event against the closed vocabulary. The worker filters
// the ingest batch through this so only known, safe rows ever land in
// D1 / the public dashboard.
export function isValidTelemetryEvent(value: unknown): value is TelemetryEvent {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Record<string, unknown>;
  if (!TELEMETRY_CATEGORIES.includes(e.category as TelemetryCategory)) return false;
  if (!TELEMETRY_ACTIONS.includes(e.action as TelemetryAction)) return false;
  // A page view is only a page view with a path (docs/specs/017-telemetry/page-view-telemetry.md).
  if (e.category === 'Page') {
    return e.action === 'View' && typeof e.type === 'string' && isValidPageViewPath(e.type);
  }
  if (e.type === undefined || e.type === null) return true;
  return typeof e.type === 'string' && TELEMETRY_TYPE_PATTERN.test(e.type);
}

// The fixed dashboard windows (docs/specs/017-telemetry/telemetry.md): no custom ranges, so queries
// stay simple and the summary response is cacheable.
export type TelemetryWindowKey = 'today' | 'last7' | 'last30';

// How many UTC calendar days each window spans, ending with today (so
// `last7` is today plus the six days before it, each from UTC midnight).
// Shared by the api, which counts each window over exactly these days, and
// the dashboard, which highlights the same span of the 30-day trend line:
// one definition, so the number on a card and the line under it agree.
export const TELEMETRY_WINDOW_DAYS: Record<TelemetryWindowKey, number> = {
  today: 1,
  last7: 7,
  last30: 30,
};

export type TelemetryCount = {
  category: string;
  action: string;
  type: string | null;
  count: number;
};

export type TelemetryWindow = {
  total: number;
  rows: TelemetryCount[];
};

// ---------------------------------------------------------------------
// AI Assistance (docs/specs/007-editor/ai-assistance.md)
// ---------------------------------------------------------------------

// Two modes (docs/specs/007-editor/ai-assistance.md): 'ask' is read-only Q&A; 'clean' tidies the existing tab.
// The old 'generate' (Build) + 'review' modes were removed — the calling model
// in an external AI tool (docs/specs/015-api/mcp-server.md) does generation far better.

// `byMetric` is the per-event version of `byCategory`: one 30-day
// series per distinct event, keyed by `metricKey(category, action,
// type)` (= `category|action|type`, empty string for a null type).
// Drives the Search view's single-metric trend line (docs/specs/017-telemetry/telemetry.md).
export type TelemetryDaily = {
  days: number[];
  totals: number[];
  byCategory: Record<string, number[]>;
  byMetric: Record<string, number[]>;
};

// Stable key for a single (category, action, type) event, used as the
// `TelemetryDaily.byMetric` map key. Defined here so the api worker
// that builds the map and the dashboard that reads it can't drift.
// `type` is null for type-less events; we collapse it to '' so the key
// is always a 3-part `a|b|c` string.
export function metricKey(category: string, action: string, type: string | null): string {
  return `${category}|${action}|${type ?? ''}`;
}

// The `Element·Added` type tokens that correspond to a PALETTE item, in
// the buckets the public dashboard ranks them by (docs/specs/017-telemetry/telemetry.md).
//
// Shared here, rather than hand-mirrored in the dashboard, because both
// ends of this have to agree exactly: the editor picks the token when it
// emits, the dashboard buckets by it when it renders, and a token in one
// but not the other is invisible in the worst way — the event is emitted,
// validated, and stored, and simply never appears on the page. That had
// already happened once: the dashboard still expected `Code-block` long
// after the editor settled on `CodeBlock`, so every code block anyone
// drew was missing from the Palette ranking.
//
// Not every `Element·Added` token belongs here. `TableRow` / `TableColumn`
// are structure edits inside an existing table, not palette picks, so they
// are deliberately absent.
export const PALETTE_TELEMETRY_TYPES = {
  shapes: [
    'Square',
    'Circle',
    'Diamond',
    'Cylinder',
    'Parallelogram',
    'Hexagon',
    'Document',
    'Stadium',
    'Cloud',
    'Triangle',
    'Trapezoid',
    'Star',
    'Speech-bubble',
  ],
  tools: [
    'Text',
    'Freehand',
    'Arrow',
    'Sticky',
    'Table',
    'Image',
    'Avatar',
    'Actor',
    'Frame',
    'Annotation',
    'LinkCard',
    // Every embed tile (YouTube / Vimeo / Loom / Figma / Google Docs / the
    // website embed, docs/specs/009-elements/website-embed.md) creates a `video` element, and all six report
    // as `Video`: the provider is not part of the token. Missing here since
    // the element shipped, so six palette tiles were counted nowhere.
    'Video',
    'Highlighter',
    'Polygon',
    'Polyline',
    'Timeline-rail',
    'CodeBlock',
    'Page',
    // Mind node (docs/specs/009-elements/mind-node.md).
    'MindNode',
    // Lane (docs/specs/009-elements/lane.md).
    'Lane',
    // Entity (docs/specs/009-elements/entity.md).
    'Entity',
    'Checklist',
    'ModeButton',
    'Portal',
    'SessionButton',
    'Reveal',
    'Picker',
    'ReactionPad',
    // Done check (docs/specs/012-collaboration/done-check.md): a Behaviour element by its palette home.
    'DoneCheck',
    // Chair (docs/specs/009-elements/chair.md): a Behaviour element, so it ranks with them.
    'Chair',
    // Bring Focus (docs/specs/012-collaboration/bring-focus.md): likewise Behaviour, in the Navigate group. The
    // token is what elementTelemetryType actually emits for the kind, which
    // for a hyphenated one is the hyphen kept (see Pie-chart above).
    'Focus-button',
    'Pie-chart',
    'Bar-chart',
    'Line-chart',
    'Progress-bar',
    'Progress-ring',
    'Rating',
    'Legend',
  ],
  // The Collaborate category (docs/specs/012-collaboration/estimate-card.md to docs/specs/012-collaboration/roll-call.md) — its own bucket rather
  // than more entries under `tools`, because the palette gave it its own
  // category and the dashboard's cards are the palette's own tabs. The Chair
  // (docs/specs/009-elements/chair.md) is NOT here: it ships in Behaviour, so it buckets with the
  // other behaviour elements under `tools` above.
  collaborate: [
    'Estimate',
    'Temperature',
    'Idea-box',
    // Q&A board (docs/specs/012-collaboration/qa-board.md).
    'Qa-board',
    'Agenda',
    'Decision',
    'Roll-call',
    // Comment pin (docs/specs/012-collaboration/comment-pin.md).
    'CommentPin',
    // Action panel (docs/specs/012-collaboration/action-panel.md).
    'ActionPanel',
  ],
  components: ['Banner', 'Hero', 'Header', 'Callout', 'StatRow', 'ProcessSteps'],
  devices: ['Browser', 'Monitor', 'Laptop', 'Phone', 'Tablet', 'Foldable', 'Smartwatch'],
  icons: ['Icon', 'TechIcon', 'Sticker'],
} as const satisfies Record<string, readonly string[]>;

// Every palette token, flattened — the set an emitter can be checked against.
export const ALL_PALETTE_TELEMETRY_TYPES: readonly string[] =
  Object.values(PALETTE_TELEMETRY_TYPES).flat();

export type TelemetrySummary = {
  enabled: boolean;
  generatedAt: number;
  windows: Record<TelemetryWindowKey, TelemetryWindow>;
  // Each window's counts over the same number of days just before it (the
  // day before today, the 7 days before the last 7, the 30 before the last
  // 30), for the dashboard's trend arrows. Optional so a client talking to an
  // older api still parses; it falls back to what the daily series can reach.
  previousWindows?: Record<TelemetryWindowKey, TelemetryWindow>;
  // Optional so older clients (and the disabled-state response) still
  // parse. Present whenever `enabled` is true.
  daily?: TelemetryDaily;
};

// -----
// Unfurl (docs/specs/009-elements/link-cards.md) — link-card preview metadata extracted server-side by
// GET /api/unfurl?url=… (the static client can't read cross-origin page
// HTML). Every field is optional: an unfurl that finds nothing still
// returns 200 with the resolved url, and the card falls back to the bare
// URL. `image` / `favicon` are absolute URLs referenced directly by the
// client (no bytes proxied in v1).
// -----
