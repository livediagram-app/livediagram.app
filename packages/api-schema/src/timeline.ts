// Timeline wire format (spec/138) — the Explorer's landing feed.
//
// The api worker emits these; the live app's Timeline pane consumes
// them. Kept in its own module rather than piled into index.ts: the
// timeline has a scope model + an event vocabulary of its own, and
// both want room to grow without the barrel becoming a catalogue.

// Who a run of events is FOR. v1 emits only 'user', where the id is an
// owner id (a Clerk `sub`, or a guest participant id per spec/04).
//
// Widened with `(string & {})` rather than closed, because the whole
// point of the scope model is that a later per-diagram or per-team feed
// is a new value plus a renderer — no schema change, no migration
// (spec/138 §3.4). The union members still autocomplete.
export type TimelineScopeType = 'user' | 'diagram' | 'team' | (string & {});

export type TimelineScopeRef = {
  scopeType: TimelineScopeType;
  scopeId: string;
};

// Serialised form used on the wire and in query params: "user:abc123".
export function formatScope(scope: TimelineScopeRef): string {
  return `${scope.scopeType}:${scope.scopeId}`;
}

// Inverse of formatScope. Splits on the FIRST colon only — a scope id
// is an opaque owner id and a Clerk `sub` may itself contain one.
// Returns null for anything without both halves, so a malformed query
// param is a 400 rather than a scope read of `""`.
export function parseScope(raw: string): TimelineScopeRef | null {
  const at = raw.indexOf(':');
  if (at <= 0 || at === raw.length - 1) return null;
  return { scopeType: raw.slice(0, at), scopeId: raw.slice(at + 1) };
}

// What kind of thing an event is ABOUT. Drives the bubble's icon,
// colour, and which filter chip hides it.
export type TimelineSourceType = 'diagram' | 'team' | 'account' | (string & {});

// What HAPPENED. Distinct from the source type: one diagram produces
// many of these over its life.
//
// A runtime array, not a bare union, so the renderers' classification maps can
// be `Record<KnownTimelineEventType, …>` and the COMPILER insists every event
// type has a tone and a filter category. They used to be `Record<string, …>`
// keyed on loose strings, with the only net a hand-copied list of all 38 types
// in eventTone.test.ts — a copy of the union, in another package, which can
// only ever prove the copy agrees with itself. (The same lesson spec/22 records
// about the palette telemetry tokens, where the copy had silently drifted.)
// Adding a type here now fails the build until it has been classified, which is
// the whole point: an unclassified event renders in a colour that says the
// wrong thing about what happened.
export const TIMELINE_EVENT_TYPES = [
  // Diagram lifecycle + the coalesced editing event (spec/138 §4.2)
  'diagram_created',
  'diagram_renamed',
  'diagram_duplicated',
  'diagram_deleted',
  'diagram_moved',
  'diagram_edited',
  'diagram_offline',
  'diagram_synced',
  'diagram_opened_by_visitor',
  'diagram_copied_by_visitor',
  'folder_created',
  'folder_deleted',
  // Collaboration (§4.3)
  'comment_added',
  'comment_resolved',
  'action_assigned',
  'action_completed',
  'share_link_created',
  'share_link_expiring',
  // Teams + invites (§4.4)
  'team_created',
  'team_invite_received',
  'team_invite_accepted',
  'team_invite_declined',
  'team_member_joined',
  'team_member_left',
  'team_member_removed',
  'team_role_changed',
  'team_diagram_added',
  // Pulled back OUT of a team library into somebody's personal files, which
  // also transfers ownership to the mover (spec/35). Distinct from
  // `diagram_moved`: the team loses the diagram, and if the mover was not the
  // owner the owner loses it too.
  'team_diagram_removed',
  'team_renamed',
  'team_deleted',
  'team_invite_link_enabled',
  'team_invite_link_disabled',
  // Account + housekeeping (§4.5)
  'token_created',
  'token_revoked',
  'token_expiring',
  'theme_saved',
  'theme_deleted',
  'image_uploaded',
] as const;

// The types this build knows about.
export type KnownTimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number];

// Still open at the edges, for the same reason as the scope type: a wire row
// written by a NEWER worker carries an event type this build has never heard
// of, and it must render (as neutral / Other) rather than fail to type-check
// or be dropped. That openness is exactly why the closed array above has to
// exist separately — `Record<TimelineEventType, …>` would be unsatisfiable.
export type TimelineEventType = KnownTimelineEventType | (string & {});

// One event on the feed.
//
// `title` and `description` are first-class rather than snapshot keys
// because every event has them — they're the universal backbone, and
// the thing a future search would index. The split is load-bearing for
// stacking: the title is a Title Case category that never carries user
// content, which is what lets four bubbles collapse into one honest
// headline (spec/138 §2.1).
export type TimelineEvent = {
  id: string;
  sourceType: TimelineSourceType;
  sourceId: string;
  eventType: TimelineEventType;
  title: string;
  description: string | null;
  // Epoch ms. May be in the FUTURE for expiry warnings, which is why
  // the feed renders a future band above Today (spec/138 §4.5).
  occurredAt: number;
  // Owner id of whoever did it, or null for a system event. The
  // renderer compares it against the viewer to choose "You" vs a name,
  // so the row itself stays viewer-agnostic and one row serves everyone
  // in the audience.
  actorId: string | null;
  // Type-specific extras. Every renderer must read these defensively —
  // rows written by an older worker won't have the newest keys.
  snapshot: Record<string, unknown>;
};

export type TimelineReadResult = {
  items: TimelineEvent[];
  // Opaque "<occurredAt>:<eventId>". Absent when the last page has
  // been served.
  nextCursor?: string;
  // The unread watermark as it stood BEFORE this read: anything newer
  // is new to this reader on this visit. The read then moves it
  // forward, so a second load of the same page reports nothing new —
  // which is the correct answer, and why the client must render from
  // the value it was given rather than re-deriving one.
  lastSeenAt?: number;
};

// The page a read serves by default, and the ceiling the endpoint will
// honour however large a `limit` a caller asks for. The cap is a server
// guard, not a client convenience: this endpoint is part of the public
// API (spec/61), so `?limit=100000` has to be bounded here.
export const TIMELINE_PAGE_SIZE = 50;
export const TIMELINE_PAGE_MAX = 200;

// How far back the feed goes before the daily sweep prunes it. A year,
// where `change_log` keeps 90 days (spec/12): an element-level audit
// trail decays in weeks, but "when did I last touch this" is a question
// people ask across a year.
export const TIMELINE_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

// Comment text rides along in the description so the feed is readable
// without opening the diagram, truncated so one essay can't dominate a
// day. Deliberately wider than spec/64's email policy (which never
// includes comment text): an email leaves the product's auth boundary,
// the Timeline sits behind the same gate as the diagram itself.
export const TIMELINE_COMMENT_MAX = 240;

// An Offline Mode conversion (spec/76), declared by the editor on the request
// that performs it, so the feed can say what actually happened.
//
// It has to be declared because the two conversions reuse ordinary endpoints
// and are indistinguishable from them at the boundary: "Take offline" is a
// plain DELETE /diagrams/:id, and "Sync diagram" is a plain POST /diagrams. So
// the worker recorded them as `diagram_deleted` and `diagram_created` — a
// Timeline that told the owner, in danger red, that a diagram they had just
// moved into this browser was *deleted*, and that one they had just uploaded
// was newly *created*. Both `diagram_offline` and `diagram_synced` already
// existed above, with tones, icons, renderers and a spec/138 table entry;
// nothing had ever emitted them.
//
// Header name + values live here, next to the event types they select, because
// this is a two-sided contract and the alternative is the client and the worker
// each holding a copy of the string.
export const DIAGRAM_CONVERSION_HEADER = 'X-Diagram-Conversion';

export type DiagramConversion = 'offline' | 'sync';

/** Reads the conversion a request declares, or null when it declares none. */
export function readDiagramConversion(value: string | null): DiagramConversion | null {
  return value === 'offline' || value === 'sync' ? value : null;
}
