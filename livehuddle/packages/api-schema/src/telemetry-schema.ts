// Telemetry wire-format (docs/specs/017-telemetry/telemetry.md): the closed category/action vocabulary,
// the TelemetryEvent shape + validator, and the dashboard summary/window
// types. Self-contained (no document deps); split out of the schema barrel.

// ---------------------------------------------------------------------
// Telemetry (docs/specs/017-telemetry/telemetry.md)
// ---------------------------------------------------------------------
//
// Anonymous, first-party product events. Each event is three small
// fields: a `category` (the parent: Document, Element, …), an `action`
// (the verb: Created, Added, …), and an optional `type` (one
// app-defined reference value: 'Square', 'Edit', a template id …).
// NEVER carries user-generated content — no names, ids, or element
// text. Shared here so the live editor's emitter and the api worker's
// ingest validator use exactly one definition (and the public
// dashboard can only ever surface values from this closed vocabulary).

import { isCtaSource } from './cta-sources';
import { isValidPageViewPath } from './page-views';
import { isTimingType } from './timing-telemetry';
import { TELEMETRY_TYPE_PATTERN } from '@liveworkspace/telemetry';

// The wire bound on `type`, the fixed dashboard windows and the summary shapes are the liveworkspace
// telemetry service's (liveworkspace/docs/specs/008-telemetry/telemetry.md), shared by every app: re-exported so callers
// here keep one import.
export {
  metricKey,
  TELEMETRY_TYPE_PATTERN,
  TELEMETRY_WINDOW_DAYS,
  type TelemetryCount,
  type TelemetryDaily,
  type TelemetrySummary,
  type TelemetryWindow,
  type TelemetryWindowKey,
} from '@liveworkspace/telemetry';

export const TELEMETRY_CATEGORIES = [
  'Document',
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
  'Session',
  // The facilitator baton (docs/specs/012-collaboration/facilitator.md): who is running a live session.
  // 'Started' when somebody takes a free one, 'Changed' when it is handed on
  // or taken back, 'Ended' when the holder steps down. `type` is the shape of
  // the move ('Claimed' / 'Granted' / 'Released'), or 'Unlocked' when the
  // facilitator frees an element somebody was holding (docs/specs/007-editor/editor-app.md lock) — never a
  // name: the question is whether rooms use the role at all, not who held it.
  'Facilitator',
  // The retired sticky-note photo import's 'Used' events. Nothing sends it any more; kept so the
  // dashboards still read the events already recorded.
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
  // API tokens (docs/specs/015-api/public-api-and-tokens.md): 'Created'/'Removed' with `type` 'Manual' (Explorer
  // New-token); 'MCP' and 'Cli', from the retired MCP consent screen and CLI sign-in, still parse.
  'Token',
  // MCP server tool calls: 'Used' with `type` the tool name. livehuddle no longer has an MCP server
  // (docs/specs/002-project-scope/not-in-livehuddle.md); kept so the events it sent still parse.
  'Mcp',
  // CLI commands: 'Used' with `type` the verb. livehuddle no longer has a CLI; kept so the events it sent still parse.
  'Cli',
  // Transactional + lifecycle email (apps/api, docs/specs/014-identity/transactional-email.md): 'Sent' with `type`
  // the template kind ('Welcome', 'TeamInvite', ...). Written server-side by
  // the api worker, which is the only place that knows a send happened —
  // nothing reaches a browser, so without this the whole onboarding series
  // was unmeasurable and a refused send was invisible. Never an
  // address, a name, or a count of recipients: the kind and nothing else.
  'Email',
  // Error tracking (docs/specs/017-telemetry/telemetry.md): generic failure counts. The action slot
  // carries the SOURCE ('Api' | 'Client', or 'Warning' for a degradation
  // the author was carried through — deliberate nouns in the verb slot);
  // `type` is a fixed kind or status token ('Http500', 'Internal',
  // 'Uncaught', 'UnhandledRejection', 'AiQuota.BrowserReader') — never a
  // message, stack, or URL.
  'Error',
  // Timeline: the Explorer's retired feed (docs/specs/013-workspace/history.md). Nothing sends it since
  // November 2026; kept so stored rows still validate and read on the dashboard.
  'Timeline',
  // Explorer Home (docs/specs/013-workspace/explorer-home.md): the landing view. 'Opened' with
  // `type` 'Landing' | 'Nav' (the page the Explorer opened on, or a later visit) ('Group', a
  // What happened summary expanded, is retired); 'Selected' with 'JumpBackIn.MostUsed' | 'JumpBackIn.Recent'
  // (a document opened from Jump back in, by the half it belongs to), 'JumpBackIn.SeeMore' (See
  // more followed to the Recent page) | 'WhatHappened' (retired) | 'Hero.Documents' | 'Hero.Inbox' (a hero
  // status pill followed) | 'Hero.NewDocument' (the hero's New document) | 'Welcome.Blank' | 'Welcome.Template' |
  // 'Welcome.AllTemplates' | 'Welcome.Search' | 'Welcome.StartBlank' | 'Welcome.SignIn' (a start taken from the
  // first-run Home); 'Opened' with 'Welcome' (the first-run Home shown); 'Loaded' with 'Retry' (a failed read
  // retried). Never a document name or a person.
  'Home',
  // Inbox (docs/specs/013-workspace/inbox.md): the Explorer's cross-document inbox of open
  // actions + comment threads. 'Opened' once per visit; 'Selected' with
  // `type` 'Action' | 'Thread' on a row click (which kind of row sends
  // people back into a document); 'Loaded'/'Retry' when a failed read is
  // retried. Never an action name, comment text, or document name.
  'Activity',
  // Page views (docs/specs/017-telemetry/page-view-telemetry.md): 'View' with `type` the normalised page path
  // ('/help/canvas/the-canvas', '/document'), reported by every
  // frontend on each path change. The one category whose `type` is a path,
  // so it validates against PAGE_VIEW_PATH_PATTERN instead of the token
  // pattern, and only ever pairs with 'View'.
  'Page',
  // Landing funnel (docs/specs/019-marketing/landing-funnel.md): a call to action on a public page brought
  // somebody to /new ('Opened'), and that visit created a document
  // ('Created'). `type` is the CTA's source from the closed CTA_SOURCES
  // table ('Home.Hero', 'Feature.Closing'), never a visitor or a URL; the
  // editor sends both, the marketing site still sends only page views.
  'Cta',
  // Trash (docs/specs/013-workspace/trash.md): the quiet backstop behind every
  // document delete. 'Opened' with `type` 'Settings' (its one way in);
  // 'Restored' / 'Deleted' (for good) / 'Cleared' (Empty
  // Trash) with `type` the Trash it happened in ('Personal' | 'Team' |
  // 'Local'). Whether people ever come back for a deleted document is the
  // question; never a document or team name.
  'Trash',
  // Draw mode (docs/specs/023-draw-mode/draw-mode.md), named 'Whiteboard' until its stored
  // history was rewritten (migration 0061): a Whiteboard tab 'Created' (`type` how:
  // 'Template' | 'NewTab' | 'Import'), a pen or the Fill tool 'Selected' ('Main' | 'Second' |
  // 'Third' | 'Path' | 'Fill'), the Fill tool 'Changed' ('FillColour', and 'FillMissed' for a press
  // that filled nothing, docs/specs/023-draw-mode/fill-tool.md),
  // a pen, the eraser mode and the background 'Changed' ('PenColour' | 'PenWidth' |
  // 'PenReset', 'CursorDot' | 'CursorCrosshair', 'EraserStroke' | 'EraserPartial', 'BackgroundPlain' | 'BackgroundDots' |
  // 'BackgroundGrid', 'SnapColours') and shape recognition 'Toggled' ('RecognitionOn' |
  // 'RecognitionOff', and for one stroke 'RecogniseOnceKey' | 'RecogniseOnceChip' |
  // 'BreakShapeKey' | 'BreakShapeChip'). Presets only; never content.
  'Draw',
  // Editor modes (docs/specs/007-editor/editor-modes.md): a person switched a tab's editor mode,
  // 'Changed' with 'ModeDiagram' | 'ModeDraw' | 'ModeWorkshop', fired before the mode applies.
  'Editor',
  // The Explorer's filters (docs/specs/013-workspace/explorer-filters.md "Telemetry"): 'Selected' with
  // `type` the facet that gained a value ('Text' | 'OpensIn' | 'Mode' | 'Kind' | 'Template' | 'MadeBy' |
  // 'Edited' | 'People' | 'Space', LENS_TELEMETRY_TYPES), from a chip, a suggestion or a typed token.
  // Never a value, a word, a team or an id.
  'Explorer',
  // Agent changesets (docs/specs/024-agents/agent-changesets.md "Observability and telemetry"):
  // 'Applied', 'Conflicted' and 'Held' for an agent's changeset, 'Reverted' for a revert of one,
  // typed by the front door ('Mcp' | 'Cli' | 'Api' | 'Editor'); 'Opened'·'Toast' when a person asks to
  // see what changed; 'Viewed' for a document view the api answered, typed by the view. Never
  // content, never an id.
  'Agent',
  // Community (docs/specs/025-community/community.md): publishing, Edit Listing and removal from the editor
  // ('Shared'/'Changed' typed by category, 'Removed'·'Post'); opens, likes, copies, reports, search and filters in
  // the Community app. Never a title, tag or id.
  'Community',
  // Timings (docs/specs/017-telemetry/timing-telemetry.md): how long a key moment of the experience took
  // (a document opening, a tab switch, a save, the live room connecting, a page's Web Vitals). Only ever
  // 'Measured', `type` the metric and the bucket its value fell in ('DocumentLoad.Under1000ms'), checked
  // against the closed list in timing-telemetry.ts. Never a raw number, never an id.
  'Timing',
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
  // Comment (docs/specs/012-collaboration/comment-mentions.md): a comment was sent with at least one @-mention.
  'Mentioned',
  'Imported',
  'Aligned',
  'Undone',
  'Redone',
  'Cleared',
  // Document / Tab (docs/specs/017-telemetry/telemetry.md): an existing document was opened, or a tab's
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
  // Something run started or ended: a tour, the facilitator baton, a Timer or Stopwatch piece
  // (docs/specs/009-elements/timer-and-stopwatch.md). (The retired Session strip timer sent these too; the retired
  // Vote's `Revealed` and `Voted` are gone, so an old client's are filtered out at ingest.)
  'Started',
  'Ended',
  // Help centre (docs/specs/017-telemetry/telemetry.md + docs/specs/018-help/help-app.md): an article was viewed, and the
  // reader rated it helpful / not-really via the article feedback widget.
  'View',
  'Helpful',
  'Unhelpful',
  // Participant (docs/specs/017-telemetry/telemetry.md): a returning browser reopened the app on a
  // later UTC day. Paired with 'Participant'/'Created', gated once per
  // UTC day client-side; type is 'Anonymous' | 'Authenticated'.
  'Returned',
  // Trash (docs/specs/013-workspace/trash.md): a deleted document was brought
  // back from the Trash.
  'Restored',
  // Agent changesets (docs/specs/024-agents/agent-changesets.md): a changeset applied.
  'Applied',
  // Agent changesets (docs/specs/024-agents/agent-changesets.md): a changeset refused because an
  // element it targets changed since the agent read it, or because a person holds one.
  'Conflicted',
  // An agent's presence on a tab created by an explicit set (docs/specs/024-agents/agent-presence.md "Observability").
  'Present',
  'Held',
  // Document views (docs/specs/024-agents/document-views.md): a view the api answered, typed by the
  // view ('Overview' | 'Outline' | 'Graph' | 'Layout' | 'Comments' | 'Show' | 'Find' | 'Lint').
  'Viewed',
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
  // Community (docs/specs/025-community/community.md): a post liked or unliked, and a post reported (typed by reason).
  'Liked',
  'Unliked',
  'Reported',
  // Timing (docs/specs/017-telemetry/timing-telemetry.md): a key moment was timed. Only ever paired with the
  // 'Timing' category.
  'Measured',
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
  // A CTA event is only ever one of our own buttons (docs/specs/019-marketing/landing-funnel.md).
  if (e.category === 'Cta') {
    return (e.action === 'Opened' || e.action === 'Created') && isCtaSource(e.type);
  }
  // A timing is only ever a known metric with one of its own buckets (docs/specs/017-telemetry/timing-telemetry.md).
  if (e.category === 'Timing') return e.action === 'Measured' && isTimingType(e.type);
  if (e.type === undefined || e.type === null) return true;
  return typeof e.type === 'string' && TELEMETRY_TYPE_PATTERN.test(e.type);
}

// The `Element·Added` type tokens that correspond to a PALETTE item, in the buckets the public dashboard ranks them
// by (docs/specs/017-telemetry/telemetry.md "The palette's categories"): one per category of livehuddle's palette,
// in the category bar's order (docs/specs/010-palette/palette-top-level-categories.md "The strip's order"), so the
// dashboard's Elements Added and Palette section read the way a Space is built.
//
// Shared here, rather than hand-mirrored in the dashboard, because both ends of this have to agree exactly: the
// editor picks the token when it emits, the dashboard buckets by it when it renders, and a token in one but not the
// other is invisible in the worst way: the event is emitted, validated, and stored, and simply never appears on the
// page. That had already happened once: the dashboard still expected `Code-block` long after the editor settled on
// `CodeBlock`, so every code block anyone drew was missing from the Palette ranking.
//
// `retired` holds the kinds that came from livediagram and that no palette category offers any more
// (docs/specs/002-project-scope/not-in-livehuddle.md): a stored one still loads, and the element code stays until
// Work Tracker #459 removes it, so a pasted or agent-made one is still counted, under Other Elements Added rather
// than a category of its own.
//
// Not every `Element·Added` token belongs here. `TableRow` / `TableColumn` are structure edits inside an existing
// table, not palette picks, so they are deliberately absent.
export const PALETTE_TELEMETRY_TYPES = {
  // Write: a word or a note, and the stickers Search finds.
  write: ['Text', 'Sticky', 'Sticker'],
  // Rooms: the floor plan, rooms and doors first, then what lays out the floor.
  rooms: [
    'Room',
    // A room drawn with the Room Builder (docs/specs/009-elements/room-builder.md "Telemetry").
    'CustomRoom',
    // The Corridor (docs/specs/009-elements/corridor.md), beside the rooms.
    'Corridor',
    'Door',
    // The Window (docs/specs/009-elements/room-builder.md "Window").
    'Window',
    'Fence',
    'Stage',
    'Stage-curtains',
    'Podium',
    'Office-pod',
    'Phone-booth',
    'Nap-pod',
    'Reception-desk',
    'Rug',
    'Pillar',
    'Column',
  ],
  // Seats: where people sit.
  seats: [
    'Chair',
    'Desk',
    'Sofa',
    'Meeting-table',
    'Bean-bag',
    'Reading-nook',
    'Hot-desk',
    'Standing-desk',
  ],
  // Perks: the office, the kitchen and the restroom.
  perks: [
    'Plant',
    'Bookshelf',
    'Printer',
    'Copier',
    'Lockers',
    'Coat-rack',
    'Umbrella-stand',
    'Water-cooler',
    'Coffee-machine',
    'Vending-machine',
    'Kitchen-counter',
    'Kitchen-sink',
    'Fridge',
    'Microwave',
    'Kettle',
    'Toilet-cubicle',
    'Washbasin',
    'Hand-dryer',
  ],
  // Play: the bar, the games, the gym and the lounge.
  play: [
    'Bar',
    'Bar-stool',
    'Drinks-cabinet',
    'Drinks-fridge',
    'Ping-pong-table',
    'Pool-table',
    'Foosball-table',
    'Arcade-machine',
    'Dartboard',
    'Treadmill',
    'Weight-bench',
    'Jukebox',
    'Fireplace',
    'Pet-bed',
  ],
  // Garden: plants, paths, garden furniture, water and fire, and the parking.
  garden: [
    'Outdoor-plant',
    'Tree',
    'Grass',
    'Garden-path',
    'Garden-fence',
    'Bench',
    'Picnic-table',
    'Hammock',
    'Garden-umbrella',
    'Fountain',
    'Pond',
    'Swimming-pool',
    'Campfire',
    'Car-park',
    'Bike-rack',
  ],
  // Meet: a meeting room's own pieces.
  meet: [
    'Screen',
    'Room-sign',
    'Notice-board',
    'World-clock',
    'Calendar-wall',
    'Suggestion-box',
    'Photo-wall',
    'Timer',
    'Stopwatch',
  ],
  // Travel: what takes people somewhere.
  travel: [
    'Portal',
    'Focus-button',
    'Avatar-pad',
    'Directory',
    'Signpost',
    'Elevator',
    'Stairs',
    'ModeButton',
  ],
  // Retired: what came from livediagram and no category offers (above).
  retired: [
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
    'Final-state',
    'Freehand',
    'Arrow',
    'Table',
    'Image',
    'Avatar',
    'Actor',
    'Frame',
    'Annotation',
    'PointerNote',
    'LinkCard',
    'Video',
    'Highlighter',
    'Polygon',
    'Polyline',
    'Timeline-rail',
    'CodeBlock',
    'Page',
    'MindNode',
    'Flowchart',
    'FlowchartStep',
    'Lane',
    'Boundary',
    'OrgChart',
    'Stack',
    'Sequence',
    'DiagramKey',
    'Entity',
    'Checklist',
    'SessionButton',
    'Reveal',
    'Picker',
    'ReactionPad',
    'DoneCheck',
    'Quiz',
    'Pie-chart',
    'Bar-chart',
    'Line-chart',
    'Progress-bar',
    'Progress-ring',
    'Rating',
    'Legend',
    'Sankey',
    'Estimate',
    'Temperature',
    'Idea-box',
    'Qa-board',
    'Agenda',
    'Decision',
    'Roll-call',
    'CommentPin',
    'ActionPanel',
    'Banner',
    'Hero',
    'Header',
    'Callout',
    'StatRow',
    'ProcessSteps',
    'Card',
    'Badge',
    'Step',
    'LayerStack',
    'Pyramid',
    'Cycle',
    'Hub',
    'Onion',
    'Chevrons',
    'Browser',
    'Monitor',
    'Laptop',
    'Phone',
    'Tablet',
    'Foldable',
    'Smartwatch',
    'Icon',
    'TechIcon',
  ],
} as const satisfies Record<string, readonly string[]>;

// Every palette token, flattened — the set an emitter can be checked against.
export const ALL_PALETTE_TELEMETRY_TYPES: readonly string[] =
  Object.values(PALETTE_TELEMETRY_TYPES).flat();

// -----
// Unfurl (docs/specs/009-elements/link-cards.md) — link-card preview metadata extracted server-side by
// GET /api/unfurl?url=… (the static client can't read cross-origin page
// HTML). Every field is optional: an unfurl that finds nothing still
// returns 200 with the resolved url, and the card falls back to the bare
// URL. `image` / `favicon` are absolute URLs referenced directly by the
// client (no bytes proxied in v1).
// -----
