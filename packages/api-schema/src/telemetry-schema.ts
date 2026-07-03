// Telemetry wire-format (spec/22): the closed category/action vocabulary,
// the TelemetryEvent shape + validator, and the dashboard summary/window
// types. Self-contained (no diagram deps); split out of the schema barrel.

// ---------------------------------------------------------------------
// Telemetry (spec/22)
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

export const TELEMETRY_CATEGORIES = [
  'Diagram',
  'Element',
  'Tab',
  'Theme',
  'Canvas',
  'Template',
  'Comment',
  'Note',
  // Assigned actions (spec/68): assign / complete / reopen / edit / delete
  // on an element's action, plus the popover open. `type` carries the
  // email-checkbox state on create ('EmailOn'/'EmailOff') and the edit
  // flavour on change ('Reassigned'/'Edited') — never action content.
  'Action',
  'Search',
  'UI',
  'Folder',
  'Session',
  'AI',
  'Team',
  // Participant lifecycle (spec/22): 'Participant'/'Created' fires
  // once per fresh browser identity mint, the daily-new-visitors
  // signal; 'Participant'/'Returned' fires once per browser per UTC
  // day when a returning visitor reopens the app, split guest vs
  // signed-in via the type. Sign-in / sign-up / sign-out stay under
  // 'Session'.
  'Participant',
  // Help centre (apps/help, spec/22 + spec/55): article views +
  // per-article helpful / not-really feedback. The second app (besides
  // the editor) that emits telemetry. `type` is the article slug.
  'Help',
  // API tokens (spec/61) + MCP connections (spec/62): 'Created'/'Removed'
  // with `type` 'Manual' (Explorer New-token) or 'MCP' (an AI tool connected
  // via the consent screen, which mints a token under the hood).
  'Token',
  // MCP server tool calls (apps/mcp, spec/62): 'Used' with `type` the tool
  // name (CreateDiagram, ReadDiagram, ...). Emitted by the MCP worker, the
  // third app that reports telemetry, so usage shows up distinctly from the
  // in-editor AI panel.
  'Mcp',
] as const;
export type TelemetryCategory = (typeof TELEMETRY_CATEGORIES)[number];

export const TELEMETRY_ACTIONS = [
  'Created',
  'Deleted',
  'Added',
  'Removed',
  'Shared',
  'Joined',
  'Used',
  'Changed',
  'Exported',
  'Locked',
  'Unlocked',
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
  // Diagram / Tab (spec/22): an existing diagram was opened, or a tab's
  // content was fetched for viewing (incl. switching to it). Fires on
  // every open, the counterpart to 'Created' — an engagement/opens signal.
  'Loaded',
  'Opened',
  'Searched',
  'Selected',
  'Toggled',
  'Zoomed',
  'Moved',
  'Rotated',
  'Closed',
  'Copied',
  'Reverted',
  'SignedIn',
  'SignedUp',
  'SignedOut',
  // Live session tools (spec/39): a timer / vote started or ended, vote
  // results revealed, and a dot cast on an element.
  'Started',
  'Ended',
  'Revealed',
  'Voted',
  // Help centre (spec/22 + spec/55): an article was viewed, and the
  // reader rated it helpful / not-really via the article feedback widget.
  'View',
  'Helpful',
  'Unhelpful',
  // Participant (spec/22): a returning browser reopened the app on a
  // later UTC day. Paired with 'Participant'/'Created', gated once per
  // UTC day client-side; type is 'Anonymous' | 'Authenticated'.
  'Returned',
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
  if (e.type === undefined || e.type === null) return true;
  return typeof e.type === 'string' && TELEMETRY_TYPE_PATTERN.test(e.type);
}

// The fixed dashboard windows (spec/22): no custom ranges, so queries
// stay simple and the summary response is cacheable.
export type TelemetryWindowKey = 'today' | 'last7' | 'last30';

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
// AI Assistance (spec/25)
// ---------------------------------------------------------------------

// Two modes (spec/25): 'ask' is read-only Q&A; 'clean' tidies the existing tab.
// The old 'generate' (Build) + 'review' modes were removed — the calling model
// in an external AI tool (spec/62) does generation far better.

// `byMetric` is the per-event version of `byCategory`: one 30-day
// series per distinct event, keyed by `metricKey(category, action,
// type)` (= `category|action|type`, empty string for a null type).
// Drives the Search view's single-metric trend line (spec/22).
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

export type TelemetrySummary = {
  enabled: boolean;
  generatedAt: number;
  windows: Record<TelemetryWindowKey, TelemetryWindow>;
  // Optional so older clients (and the disabled-state response) still
  // parse. Present whenever `enabled` is true.
  daily?: TelemetryDaily;
};

// -----
// Unfurl (spec/40) — link-card preview metadata extracted server-side by
// GET /api/unfurl?url=… (the static client can't read cross-origin page
// HTML). Every field is optional: an unfurl that finds nothing still
// returns 200 with the resolved url, and the card falls back to the bare
// URL. `image` / `favicon` are absolute URLs referenced directly by the
// client (no bytes proxied in v1).
// -----
