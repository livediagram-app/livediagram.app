import { PALETTE_TELEMETRY_TYPES, pageViewApp, type PageViewApp } from '@livediagram/api-schema';
import { isRecovery, isServerCrash } from './error-kinds';
import {
  canonicalElementType,
  PALETTE_KINDS,
  SELECTION_MODES,
  type PaletteTab,
} from './palette-types';
import { CUSTOM_THEME_TYPES, NON_PATTERN_CANVAS_TYPES } from './look-feel-types';
import type { Metric, MetricStack, Rising } from './metric-series';

// Charts defined once and reused (spec/22). A chart stack references these
// rather than declaring its own copies, so one chart can sit in several
// stacks, on several tabs, or on its own, and its wording stays in one place.

// One chart over a set of types (or every type) of one category and action,
// with optional further actions. Keeps the long tail below readable.
const chart = (
  category: string,
  action: string,
  title: string,
  blurb: string,
  opts: {
    types?: readonly string[];
    typeIn?: (type: string | null) => boolean;
    actionIn?: readonly string[];
    rising?: Rising;
  } = {},
): Metric => ({
  category,
  action,
  ...(opts.actionIn ? { actionIn: opts.actionIn } : {}),
  ...(opts.typeIn
    ? { typeIn: opts.typeIn }
    : opts.types
      ? { typeIn: (type: string | null) => type !== null && opts.types!.includes(type) }
      : { allTypes: true }),
  title,
  blurb,
  ...(opts.rising ? { rising: opts.rising } : {}),
});

// Filling out existing stacks.
export const JUST_DRAW = chart(
  'UI',
  'Used',
  'Just Draw',
  'Straight to a blank canvas from the site header, skipping the wizard.',
  { types: ['JustDraw'] },
);
export const TEMPLATE_LINKS = chart(
  'UI',
  'Used',
  'Template Links',
  'A diagram started from a template link.',
  { types: ['TemplateLink'] },
);
export const TAB_TEXT_DEFAULTS = chart(
  'Tab',
  'Changed',
  'Tab Text Defaults',
  'A tab’s font or default text size changed.',
  { types: ['Font', 'DefaultTextSize'] },
);
export const TABS_ARRANGED = chart(
  'Tab',
  'Aligned',
  'Tabs Auto-Arranged',
  'A tab laid out automatically: tree, flowchart or mindmap.',
);
export const TABS_REORDERED = chart(
  'Tab',
  'Reordered',
  'Tabs Reordered',
  'Tab pills dragged into a new order.',
);
export const VOTES_ENDED = chart(
  'Tab',
  'Ended',
  'Votes Ended',
  'A vote closed, keeping its tallies.',
  { types: ['Vote'] },
);
export const VOTE_REVIEWS_ENDED = chart(
  'Tab',
  'Ended',
  'Vote Reviews Ended',
  'The review of a revealed vote closed.',
  { types: ['VoteReview'] },
);
export const LAYERS_RENAMED = chart(
  'Layer',
  'Renamed',
  'Layers Renamed',
  'A layer renamed by hand, or adopting a name from its contents.',
);
export const LAYERS_SELECTED = chart(
  'Layer',
  'Selected',
  'Layers Selected',
  'A layer made the active one.',
);
export const LAYERS_REORDERED = chart(
  'Layer',
  'Reordered',
  'Layers Reordered',
  'Layers dragged into a new order.',
);
export const FOLDERS_DELETED = chart('Folder', 'Deleted', 'Folders Deleted', 'A folder removed.', {
  rising: 'neutral',
});
export const FOLDERS_RENAMED = chart(
  'Folder',
  'Renamed',
  'Folders Renamed',
  'A folder renamed, in your Explorer or a team library.',
);
export const TEAM_DIAGRAMS_MOVED = chart(
  'Team',
  'Moved',
  'Team Diagrams Moved',
  'A diagram moved within a team library.',
);
export const NOTES_DELETED = chart(
  'Note',
  'Deleted',
  'Notes Deleted',
  'A note cleared from an element.',
  { rising: 'neutral' },
);
export const ACTIONS_EDITED = chart(
  'Action',
  'Changed',
  'Actions Edited',
  'An assigned action edited or reassigned.',
);
export const ACTIONS_OPENED = chart(
  'Action',
  'Opened',
  'Actions Opened',
  'An element’s actions opened.',
);
export const ACTIONS_DELETED = chart(
  'Action',
  'Deleted',
  'Actions Deleted',
  'An assigned action removed.',
  { rising: 'neutral' },
);
export const SHARE_LINKS_COPIED = chart(
  'UI',
  'Copied',
  'Share Links Copied',
  'A share link, embed code or live image copied.',
);
export const SHARE_SETTINGS = chart(
  'Diagram',
  'Shared',
  'Share Link Settings',
  'A password or an expiry set on a share link.',
  { typeIn: (t) => t !== 'Edit' && t !== 'View' },
);
export const SHARE_LINKS_REMOVED = chart(
  'Diagram',
  'Removed',
  'Share Links Removed',
  'A share link switched off.',
  { rising: 'neutral' },
);
export const FACILITATOR_CLAIMED = chart(
  'Facilitator',
  'Started',
  'Facilitator Claimed',
  'Someone took the facilitator role in a session.',
);
export const FACILITATOR_RELEASED = chart(
  'Facilitator',
  'Ended',
  'Facilitator Released',
  'The facilitator role handed back.',
);
export const AVATARS_CUSTOMISED = chart(
  'UI',
  'Changed',
  'Avatars Customised',
  'Someone changed their avatar: randomised, clothing, or figure.',
  { typeIn: (t) => (t ?? '').startsWith('Avatar') },
);

export const NEW_VISITORS: Metric = {
  category: 'Participant',
  action: 'Created',
  type: null,
  title: 'New Visitors',
};

export const RETURNING_VISITORS: Metric = {
  category: 'Participant',
  action: 'Returned',
  allTypes: true,
  title: 'Returning Visitors',
  blurb:
    'Browsers that came back on a later day than their first visit, counted once per day. Sum of guests and signed-in users.',
};

export const SIGN_UPS: Metric = {
  category: 'Session',
  action: 'SignedUp',
  type: null,
  title: 'Sign-Ups',
};

export const SIGN_INS: Metric = {
  category: 'Session',
  action: 'SignedIn',
  type: null,
  title: 'Sign-Ins',
};

export const SIGN_OUTS: Metric = {
  rising: 'neutral',
  category: 'Session',
  action: 'SignedOut',
  type: null,
  title: 'Sign-Outs',
};

export const ACCOUNTS_DELETED: Metric = {
  rising: 'bad',
  category: 'Session',
  action: 'Deleted',
  type: 'Account',
  title: 'Accounts Deleted',
  blurb: 'Signed-in users who deleted their account and all of its data.',
};

// Stacks shared by more than one tab, defined once like the charts above.
export const ACCOUNT_ACTIVITY: MetricStack = {
  rising: 'neutral',
  stack: true,
  title: 'Account Activity',
  blurb:
    'Accounts made, signed into, signed out of, and deleted. Only fires where sign-in is configured.',
  members: [SIGN_UPS, SIGN_INS, SIGN_OUTS, ACCOUNTS_DELETED],
  headline: SIGN_UPS,
};

// Page views by the app that serves them (spec/150). Each app's card sums the
// `Page·View·<path>` rows whose path that app serves.
const pagesOf = (app: PageViewApp, blurb: string): Metric => ({
  category: 'Page',
  action: 'View',
  typeIn: (type) => type !== null && pageViewApp(type) === app,
  title: app,
  blurb,
});

export const MARKETING_PAGES = pagesOf(
  'Marketing',
  'The landing page, features, alternatives, FAQ and legal pages.',
);
export const LIVE_PAGES = pagesOf(
  'Live',
  'The Explorer, the New Diagram wizard, sign-in, and every diagram.',
);
export const HELP_PAGES = pagesOf(
  'Help',
  'The help centre: its home, categories and every article.',
);
export const DASHBOARD_PAGES = pagesOf('Dashboard', 'This public telemetry dashboard.');

// Emails sent, one per template (spec/64), by the `kind` the api worker
// reports on `Email·Sent`. The kind only, never a recipient. Grouped the way
// the templates are: the onboarding series and nudges, then notifications
// about other people's activity, then account notices. `metric-series.test`
// fails if a template has no chart here, so the Emails Sent stack's total can
// never quietly miss one.
const email = (type: string, title: string, blurb: string, rising?: Rising): Metric => ({
  category: 'Email',
  action: 'Sent',
  type,
  title,
  blurb,
  rising,
});

export const WELCOME_EMAILS = email(
  'Welcome',
  'Welcome Emails',
  'Sent on sign-up, the first of the onboarding series.',
);
export const WEEK1_EMAILS = email(
  'Week1',
  'Week 1 Emails',
  'Onboarding, a week after sign-up: finding your way around the Explorer.',
);
export const WEEK2_EMAILS = email(
  'Week2',
  'Week 2 Emails',
  'Onboarding, two weeks after sign-up: bringing your team onto the canvas.',
);
export const ACTIVATION_EMAILS = email(
  'Activation',
  'Activation Nudges',
  'A new account with no diagrams yet, about three days after sign-up.',
  'neutral',
);
export const WIN_BACK_EMAILS = email(
  'WinBack',
  'Win-Back Emails',
  'An account that has gone quiet for about four weeks.',
  'neutral',
);
export const MILESTONE_EMAILS = email(
  'Milestone',
  'Milestone Emails',
  'An owner reached their tenth diagram. Sent once per account.',
);
export const FIRST_SHARE_EMAILS = email(
  'FirstShare',
  'First Share Emails',
  'An owner created their first-ever share link. Sent once per account.',
);
export const TEAM_INVITE_EMAILS = email(
  'TeamInvite',
  'Team Invites',
  'Read against Teams / Members Added on the Collaboration tab for invite conversion.',
);
export const INVITE_RESPONSE_EMAILS = email(
  'InviteResponse',
  'Invite Responses',
  "A team's admins told that an invitee accepted or declined.",
);
export const DIAGRAM_JOINED_EMAILS = email(
  'DiagramJoined',
  'Diagram Joined Emails',
  'An owner told that someone opened one of their shared diagrams for the first time.',
);
export const COMMENT_EMAILS = email(
  'CommentNotification',
  'Comment Notifications',
  'An owner told someone commented on their diagram. At most one per diagram in a burst.',
);
export const ACTION_EMAILS = email(
  'ActionAssigned',
  'Action Notifications',
  'A teammate was emailed about work assigned to them (spec/68).',
);
export const TOKEN_EXPIRING_EMAILS = email(
  'TokenExpiring',
  'Token Expiry Warnings',
  'An API token is within a week of its six-month expiry. Once per token.',
  'neutral',
);
export const ACCOUNT_DELETED_EMAILS = email(
  'AccountDeleted',
  'Account Deleted Emails',
  'The confirmation sent after someone deletes their account.',
  'bad',
);

export const EMAIL_KIND_METRICS: readonly Metric[] = [
  WELCOME_EMAILS,
  WEEK1_EMAILS,
  WEEK2_EMAILS,
  ACTIVATION_EMAILS,
  WIN_BACK_EMAILS,
  MILESTONE_EMAILS,
  FIRST_SHARE_EMAILS,
  TEAM_INVITE_EMAILS,
  INVITE_RESPONSE_EMAILS,
  DIAGRAM_JOINED_EMAILS,
  COMMENT_EMAILS,
  ACTION_EMAILS,
  TOKEN_EXPIRING_EMAILS,
  ACCOUNT_DELETED_EMAILS,
];

export const EMAILS_SENT: MetricStack = {
  rising: 'neutral',
  stack: true,
  title: 'Emails Sent',
  blurb:
    'Every transactional and lifecycle email that left the worker, one chart per template. The kind only, never a recipient.',
  members: [...EMAIL_KIND_METRICS],
};

// The long tail, found by metric-emitters.test's every-event check.
export const ACTIONS_MOVED_TO_TEAM = chart(
  'Action',
  'Moved',
  'Actions Moved to a Team',
  'An action’s diagram moved into a team so the assignee can reach it.',
);
export const ACTIONS_REOPENED = chart(
  'Action',
  'Unresolved',
  'Actions Reopened',
  'A completed action marked not done again.',
  { rising: 'neutral' },
);
export const FEED_RETRIES = chart(
  'Activity',
  'Loaded',
  'Activity Feed Retries',
  'The activity feed retried after failing to load.',
  { rising: 'bad' },
);
export const TIMELINE_LOADS = chart(
  'Timeline',
  'Loaded',
  'Timeline Loads',
  'More of the Timeline loaded, or a failed load retried.',
);
export const TIMELINE_VIEW_SWITCHED = chart(
  'Timeline',
  'Changed',
  'Timeline View Switched',
  'The Timeline switched between its list and calendar.',
);
export const TIMELINE_FILTERED = chart(
  'Timeline',
  'Selected',
  'Timeline Filtered',
  'The Timeline narrowed to everyone, others, or a kind of event.',
);
export const COMMENTS_DELETED = chart(
  'Comment',
  'Deleted',
  'Comments Deleted',
  'A comment removed.',
  { rising: 'neutral' },
);
export const COMMENTS_REOPENED = chart(
  'Comment',
  'Unresolved',
  'Comments Reopened',
  'A resolved thread opened again.',
  { rising: 'neutral' },
);
export const LINKS_REMOVED = chart(
  'Element',
  'Unlinked',
  'Links Removed',
  'A link taken off an element.',
  { rising: 'neutral' },
);
export const FACILITATOR_CONTROLS = chart(
  'Facilitator',
  'Changed',
  'Facilitator Controls',
  'The facilitator granted editing or unlocked the room.',
);
export const LAYER_OPACITY = chart(
  'Layer',
  'Changed',
  'Layer Opacity',
  'A layer’s opacity changed.',
);
export const LAYERS_CLEARED = chart(
  'Layer',
  'Cleared',
  'Layers Cleared',
  'A layer emptied but kept.',
  { rising: 'neutral' },
);
export const LAYERS_MERGED = chart(
  'Layer',
  'Removed',
  'Layers Merged',
  'A layer merged into the one above or below.',
  { types: ['MergedDown', 'MergedUp'] },
);
export const NOTES_EDITED = chart('Note', 'Changed', 'Notes Edited', 'A written note changed.');
export const NOTE_FORMATTING = chart(
  'Note',
  'Used',
  'Note Formatting',
  'Rich-text formatting used inside a note.',
);
export const EMBEDS_VIEWED = chart(
  'Session',
  'Opened',
  'Embeds Viewed',
  'A diagram opened inside another site through its embed.',
  { types: ['Embed'] },
);
export const TABS_CLEARED = chart(
  'Tab',
  'Cleared',
  'Tabs Cleared',
  'Everything on a tab removed at once.',
  { rising: 'neutral' },
);
export const TABS_LINKED = chart('Tab', 'Linked', 'Tabs Linked', 'A link to another tab added.');
export const TABS_LOCKED = chart(
  'Tab',
  'Locked',
  'Tabs Locked & Unlocked',
  'A tab locked against edits, or unlocked.',
  { actionIn: ['Unlocked'] },
);
export const TABS_UNFILED = chart(
  'Tab',
  'Removed',
  'Tabs Unfiled',
  'A tab taken out of a tab folder.',
  { types: ['Folder'], rising: 'neutral' },
);
export const TIMERS_RESUMED = chart(
  'Tab',
  'Toggled',
  'Timers Resumed',
  'Countdowns and stopwatches together: the editor does not say which. A paused timer set running again.',
  { types: ['TimerResumed'] },
);
export const TEAM_CHANGES = chart(
  'Team',
  'Changed',
  'Team Changes',
  'A team renamed or a member’s role changed.',
);
export const TEAMS_DELETED = chart('Team', 'Deleted', 'Teams Deleted', 'A team removed.', {
  rising: 'neutral',
});
export const TEAM_REMOVALS = chart(
  'Team',
  'Removed',
  'Team Removals',
  'A member, a diagram or an invite link taken out of a team, or someone leaving.',
  { rising: 'neutral' },
);
export const INVITE_LINKS_SHARED = chart(
  'Team',
  'Shared',
  'Invite Links Shared',
  'A team invite link made to share.',
);
export const MODE_OPTIONS = chart(
  'UI',
  'Changed',
  'Mode Options',
  'Settings inside a canvas mode: eraser, laser, spotlight and format painter options.',
  { typeIn: (t) => /^(Eraser|Laser|Spotlight|Format)/.test(t ?? '') },
);
export const SLIDE_NOTES = chart(
  'UI',
  'Changed',
  'Slide Notes',
  'Speaker notes on a slide edited.',
  { types: ['SlideNotes'] },
);
export const TOURS_DECLINED = chart(
  'UI',
  'Ended',
  'Tours Declined',
  'The tour offer turned down.',
  { types: ['TourDeclined'], rising: 'neutral' },
);
export const LIVE_IMAGE_TABS = chart(
  'UI',
  'Selected',
  'Live Image Tabs Picked',
  'A tab chosen for a live image link.',
  { types: ['LiveImageTab'] },
);

// Diagram lifecycle.
export const DIAGRAMS_LOADED: Metric = {
  category: 'Diagram',
  action: 'Loaded',
  type: null,
  title: 'Diagrams Loaded',
  blurb:
    'A diagram was opened, counted on every open (including a page refresh), not just the first time. Includes the first open of every new diagram, straight after it is created.',
};
export const DIAGRAMS_CREATED: Metric = {
  category: 'Diagram',
  action: 'Created',
  allTypes: true,
  title: 'Diagrams Created',
  blurb:
    'New diagrams from the New Diagram wizard, stored in the cloud or offline in this browser.',
};
export const DIAGRAMS_RENAMED: Metric = {
  category: 'Diagram',
  action: 'Renamed',
  type: null,
  title: 'Diagrams Renamed',
};
export const DIAGRAMS_DELETED: Metric = {
  rising: 'neutral',
  category: 'Diagram',
  action: 'Deleted',
  type: null,
  title: 'Diagrams Deleted',
};
export const DIAGRAMS_DUPLICATED: Metric = {
  category: 'Diagram',
  action: 'Duplicated',
  allTypes: true,
  title: 'Diagrams Duplicated',
  blurb: 'A diagram copied from the Explorer, or a shared diagram cloned into your own account.',
};

// Tab lifecycle.
export const TABS_LOADED: Metric = {
  category: 'Tab',
  action: 'Loaded',
  type: null,
  title: 'Tabs Loaded',
  blurb:
    "A tab's content was fetched for viewing, counted each time (the first tab when a diagram opens, then each tab switched to).",
};
export const TABS_CREATED: Metric = {
  category: 'Tab',
  action: 'Created',
  type: null,
  title: 'Tabs Created',
};
export const TABS_RENAMED: Metric = {
  category: 'Tab',
  action: 'Renamed',
  type: null,
  title: 'Tabs Renamed',
};
export const TABS_DELETED: Metric = {
  rising: 'neutral',
  category: 'Tab',
  action: 'Deleted',
  type: null,
  title: 'Tabs Deleted',
};
export const TABS_DUPLICATED: Metric = {
  category: 'Tab',
  action: 'Duplicated',
  type: null,
  title: 'Tabs Duplicated',
};

// Exports sit in the Export & Import stack below.

export const EXPORTS: Metric = {
  category: 'Diagram',
  action: 'Exported',
  allTypes: true,
  title: 'Exports',
  blurb:
    'A tab or selection exported, across every format (PNG, SVG, PDF, JSON, Mermaid, Markdown, Excalidraw). For the text formats, copying to the clipboard counts as an export too.',
};

// The returning-visitor split by sign-in state (All Visitors below):
// Returning Visitors sums both.
export const RETURNING_GUESTS: Metric = {
  category: 'Participant',
  action: 'Returned',
  type: 'Anonymous',
  title: 'Returning Guests',
  blurb: 'Returning visitors who are not signed in.',
};

export const RETURNING_SIGNED_IN: Metric = {
  category: 'Participant',
  action: 'Returned',
  type: 'Authenticated',
  title: 'Returning Signed-In',
  blurb: 'Returning visitors who are signed in with an account.',
};

// The diagram + tab lifecycle as stacks (Dashboard). Loaded is the opens
// signal (every open, including a new diagram's first), read against the
// once-per-object Created beside it.
export const DIAGRAM_ACTIONS: MetricStack = {
  stack: true,
  title: 'Diagram Actions',
  blurb: 'Diagrams opened, made, renamed, deleted and duplicated.',
  members: [
    DIAGRAMS_LOADED,
    DIAGRAMS_CREATED,
    DIAGRAMS_RENAMED,
    DIAGRAMS_DELETED,
    DIAGRAMS_DUPLICATED,
    JUST_DRAW,
    TEMPLATE_LINKS,
  ],
};

export const TAB_ACTIONS: MetricStack = {
  stack: true,
  title: 'Tab Actions',
  blurb: 'Tabs opened, made, renamed, deleted and duplicated.',
  members: [
    TABS_LOADED,
    TABS_CREATED,
    TABS_RENAMED,
    TABS_DELETED,
    TABS_DUPLICATED,
    TAB_TEXT_DEFAULTS,
    TABS_ARRANGED,
    TABS_REORDERED,
    TABS_LINKED,
    TABS_LOCKED,
    TABS_CLEARED,
  ],
};

// AI assistance (Editing tab). Ask and Clean split AI Requests by mode.
export const AI_REQUESTS: Metric = {
  category: 'AI',
  action: 'Used',
  allTypes: true,
  title: 'AI Requests',
  blurb:
    'A completed request in the editor AI panel, across both modes (Ask, Clean). Refusals and failures are not counted (spec/25).',
};
export const AI_ASK: Metric = {
  category: 'AI',
  action: 'Used',
  type: 'Ask',
  title: 'Ask Requests',
  blurb: 'AI requests in Ask mode: read-only questions about the diagram. Part of AI Requests.',
};
export const AI_CLEAN: Metric = {
  category: 'AI',
  action: 'Used',
  type: 'Clean',
  title: 'Clean Requests',
  blurb:
    'AI requests in Clean mode: tidy-the-tab runs, the one mode that changes the canvas. Part of AI Requests.',
};
export const AI_ASSISTANCE: MetricStack = {
  stack: true,
  title: 'AI Assistance',
  blurb: 'Requests in the editor AI panel, and how they split between Ask and Clean.',
  members: [AI_REQUESTS, AI_ASK, AI_CLEAN],
  headline: AI_REQUESTS,
};

// Programmatic access (Dashboard, Connections): the API-token lifecycle and
// what the MCP server's tools actually get used for.
export const TOKENS_CREATED: Metric = {
  category: 'Token',
  action: 'Created',
  type: 'Manual',
  title: 'Tokens Created',
  blurb: 'Personal API tokens minted by hand from the Explorer.',
};
export const AI_TOOLS_CONNECTED: Metric = {
  category: 'Token',
  action: 'Created',
  type: 'MCP',
  title: 'AI Tools Connected',
  blurb: 'AI assistants that connected through the MCP OAuth consent screen.',
};
export const TOKENS_REVOKED: Metric = {
  rising: 'neutral',
  category: 'Token',
  action: 'Removed',
  type: null,
  title: 'Tokens Revoked',
  blurb: 'API tokens revoked, whether minted by hand or by an AI tool.',
};

export const API_TOKEN_ACTIVITY: MetricStack = {
  rising: 'neutral',
  stack: true,
  title: 'API Token Activity',
  blurb:
    'Every token event: minted by hand, minted by an AI tool connecting over MCP, and revoked.',
  members: [TOKENS_CREATED, AI_TOOLS_CONNECTED, TOKENS_REVOKED],
};

// MCP tool calls, one chart per tool the MCP server registers (apps/mcp
// tools.ts), by the `Mcp·Used·<Tool>` token it reports on a call that
// succeeded. Together they are every tool call, so the stack's sum is the
// total; `metric-series.test` fails if a registered tool has no chart here.
const mcpTool = (type: string, title: string, blurb: string): Metric => ({
  category: 'Mcp',
  action: 'Used',
  type,
  title,
  blurb,
});

export const MCP_TOOL_METRICS: readonly Metric[] = [
  mcpTool('FindDiagrams', 'Find Diagrams', 'Searching the user’s diagrams by name.'),
  mcpTool('ReadDiagram', 'Read Diagram', 'Reading one diagram’s tabs and elements.'),
  mcpTool('ListTemplates', 'List Templates', 'Listing the templates a diagram can start from.'),
  mcpTool('CreateDiagram', 'Create Diagram', 'Making a new diagram.'),
  mcpTool('AddTab', 'Add Tab', 'Adding a tab to an existing diagram.'),
  mcpTool('UpdateDiagram', 'Update Diagram', 'Editing a diagram’s elements.'),
  mcpTool('ShareDiagram', 'Share Diagram', 'Creating a share link for a diagram.'),
  mcpTool('RenameDiagram', 'Rename Diagram', 'Renaming a diagram.'),
  mcpTool('DeleteDiagram', 'Delete Diagram', 'Deleting a diagram.'),
];

export const MCP_TOOL_CALLS: MetricStack = {
  stack: true,
  title: 'MCP Tool Calls',
  blurb:
    'AI assistants calling the livediagram MCP server, by tool. Only calls that succeeded count.',
  members: [...MCP_TOOL_METRICS],
};

// Elements added, one chart per palette tab (Palette tab ranks inside each),
// plus every kind the catalogue doesn't list, so together they cover every
// Element·Added exactly once and the stack's total is every element added.
// Copies count: a duplicate or paste adds one per element it creates.
const addedFrom = (tab: PaletteTab, title: string, blurb: string): Metric => ({
  category: 'Element',
  action: 'Added',
  typeIn: (type) =>
    (PALETTE_TELEMETRY_TYPES[tab] as readonly string[]).includes(canonicalElementType(type)),
  title,
  blurb,
});

export const SHAPES_ADDED = addedFrom(
  'shapes',
  'Shapes Added',
  'Boxes, circles, flowchart symbols and other primitives.',
);
export const TOOLS_ADDED = addedFrom(
  'tools',
  'Tools Added',
  'Text, arrows, stickies, tables, charts and other building blocks.',
);
export const COLLABORATE_ADDED = addedFrom(
  'collaborate',
  'Collaborate Added',
  'Estimate cards, temperature checks, idea boxes, agendas, decisions and roll calls.',
);
export const COMPONENTS_ADDED = addedFrom(
  'components',
  'Components Added',
  'Web components that lay themselves out: banners, callouts, stat rows, heroes.',
);
export const DEVICES_ADDED = addedFrom('devices', 'Devices Added', 'Device frames and mockups.');
export const ICONS_ADDED = addedFrom('icons', 'Icons Added', 'Line-art and technology icons.');
export const OTHER_ELEMENTS_ADDED: Metric = {
  category: 'Element',
  action: 'Added',
  typeIn: (type) => !PALETTE_KINDS.has(canonicalElementType(type)),
  title: 'Other Elements Added',
  blurb: 'Kinds the palette catalogue does not list, such as pasted images.',
};

export const ELEMENTS_ADDED: MetricStack = {
  stack: true,
  title: 'Elements Added',
  blurb:
    'Everything put on a canvas, by the palette tab it comes from. Copies count too: a duplicate or paste adds one per element.',
  members: [
    SHAPES_ADDED,
    TOOLS_ADDED,
    COLLABORATE_ADDED,
    COMPONENTS_ADDED,
    DEVICES_ADDED,
    ICONS_ADDED,
    OTHER_ELEMENTS_ADDED,
  ],
  seeAlso: { view: 'palette', label: 'See Each Element on the Palette Tab' },
};

// Layers (spec/74): made, used, and looked at.
export const LAYERS_CREATED: Metric = {
  category: 'Layer',
  action: 'Added',
  type: null,
  title: 'Layers Created',
  blurb: 'A new layer on a tab (spec/74).',
};
export const LAYER_TOGGLES: Metric = {
  category: 'Layer',
  action: 'Toggled',
  allTypes: true,
  title: 'Visibility & Lock Toggles',
  blurb:
    'The eye and the padlock, across hide / show / lock / unlock. The gesture layers are actually for.',
};
export const LAYER_MOVES: Metric = {
  category: 'Layer',
  action: 'Moved',
  type: null,
  title: 'Selections Moved to a Layer',
  blurb: 'Elements sent to another layer: layers being used to organise, not just to hide.',
};
export const LAYERS_DELETED: Metric = {
  rising: 'neutral',
  category: 'Layer',
  action: 'Deleted',
  type: null,
  title: 'Layers Deleted',
};
export const LAYERS_PANEL_OPENED: Metric = {
  category: 'Layer',
  action: 'Opened',
  allTypes: true,
  title: 'Layers Panel Opened',
  blurb: 'Read against the layer counts: a panel opened far more often than used is a hint.',
};

export const LAYERS_FEATURE: MetricStack = {
  stack: true,
  title: 'Layers Feature',
  blurb: 'Every layer interaction: layers made, toggled, filled, deleted, and the panel opened.',
  members: [
    LAYERS_CREATED,
    LAYER_TOGGLES,
    LAYER_MOVES,
    LAYERS_DELETED,
    LAYERS_PANEL_OPENED,
    LAYERS_RENAMED,
    LAYERS_SELECTED,
    LAYERS_REORDERED,
    LAYER_OPACITY,
    LAYERS_MERGED,
    LAYERS_CLEARED,
  ],
};

// Error health (Exceptions tab). One side of each failure only: a server crash
// is reported twice, the api worker's Internal.<Method>.<Route> and the Http500
// its caller saw, so Failed Requests and Server Crashes are read side by side,
// never added.
export const FAILED_REQUESTS: Metric = {
  rising: 'bad',
  category: 'Error',
  action: 'Api',
  typeIn: (type) => !isServerCrash(type),
  title: 'Failed Requests',
  blurb:
    'Requests a caller saw fail: non-2xx responses and dropped requests in the editor, failed api calls inside MCP tools, and failed email sends. A server crash appears here as the Http500 its caller saw.',
};
export const SERVER_CRASHES: Metric = {
  rising: 'bad',
  category: 'Error',
  action: 'Api',
  typeIn: isServerCrash,
  title: 'Server Crashes',
  blurb:
    'Unhandled exceptions the api worker reported about itself, by route. Most also appear as an Http500 in Failed Requests, so read the two side by side rather than adding them.',
};
export const CLIENT_EXCEPTIONS: Metric = {
  rising: 'bad',
  category: 'Error',
  action: 'Client',
  typeIn: (type) => !isRecovery(type),
  title: 'Client Exceptions',
  blurb:
    'Uncaught exceptions, unhandled promise rejections, and editor areas that failed to render, in the editor and help centre.',
};
export const REALTIME_RESYNCS: Metric = {
  rising: 'bad',
  category: 'Error',
  action: 'Client',
  typeIn: isRecovery,
  title: 'Realtime Resyncs',
  blurb:
    'Not an exception: the editor noticed it had missed live updates and refetched the diagram to catch up. A rising line means the realtime room is dropping updates.',
};

// Headed by the errors someone actually hit, each once: failed requests plus
// client exceptions. Server crashes would count those failures a second time
// and resyncs are recoveries, so neither joins the headline.
export const EXCEPTIONS: MetricStack = {
  rising: 'bad',
  stack: true,
  title: 'Exceptions',
  blurb:
    'Errors people hit, from failed requests and client exceptions, beside the server crashes behind them and the realtime resyncs that recovered. Zero is the goal.',
  members: [FAILED_REQUESTS, SERVER_CRASHES, CLIENT_EXCEPTIONS, REALTIME_RESYNCS],
  headline: [FAILED_REQUESTS, CLIENT_EXCEPTIONS],
  seeAlso: { view: 'exceptions', label: 'See Each Error on the Exceptions Tab' },
};

// ---- Collaboration tab -------------------------------------------------------
// Everything but Live Together counts an INVITATION (a link made, a member
// added, a poll opened); Live Together counts two people on one canvas at the
// same moment, which is what the rest is FOR, so read the rest against it. The
// facilitation tools (spec/39 + spec/88) are read by their drop-off: votes
// started vs revealed, dots cast vs retracted, timers started vs finished.

export const MULTIPLAYER_SESSIONS: Metric = {
  category: 'Diagram',
  action: 'Used',
  type: 'Multiplayer',
  title: 'Multiplayer Sessions',
  blurb:
    'A diagram was open with at least one other person live in the room. Counted once per diagram per visit, however many people turn up.',
};
export const VIEWPORTS_FOLLOWED: Metric = {
  category: 'Canvas',
  action: 'Used',
  type: 'FollowMe',
  title: 'Viewports Followed',
  blurb:
    "Someone pinned their canvas to a peer's (spec/131): the strongest signal that a session is being presented rather than just co-edited.",
};
export const EDIT_LINKS_SHARED: Metric = {
  category: 'Diagram',
  action: 'Shared',
  type: 'Edit',
  title: 'Edit Links Shared',
};
export const VIEW_LINKS_SHARED: Metric = {
  category: 'Diagram',
  action: 'Shared',
  type: 'View',
  title: 'View Links Shared',
};
export const COLLABORATORS_JOINED: Metric = {
  category: 'Diagram',
  action: 'Joined',
  type: 'Edit',
  title: 'Collaborators Joined',
  blurb:
    'People who came into a diagram through an edit link. Counted once per person per diagram, not on every revisit.',
};
export const VIEWERS_JOINED: Metric = {
  category: 'Diagram',
  action: 'Joined',
  type: 'View',
  title: 'Viewers Joined',
  blurb:
    'People who came into a diagram through a view-only link. Counted once per person per diagram, not on every revisit.',
};
export const COMMENTS_ADDED: Metric = {
  category: 'Comment',
  action: 'Added',
  type: null,
  title: 'Comments Added',
};
export const COMMENT_POPOVERS_OPENED: Metric = {
  category: 'Comment',
  action: 'Opened',
  type: null,
  title: 'Comment Popovers Opened',
  blurb:
    "Someone opened an element's comments to read or reply. Not a new thread: a new comment is Comments Added.",
};
export const COMMENTS_RESOLVED: Metric = {
  category: 'Comment',
  action: 'Resolved',
  type: null,
  title: 'Comments Resolved',
};
export const TEAMS_CREATED: Metric = {
  category: 'Team',
  action: 'Created',
  type: null,
  title: 'Teams Created',
  blurb: 'A new team workspace was created.',
};
export const INVITES_SENT: Metric = {
  category: 'Team',
  action: 'Added',
  type: 'Member',
  title: 'Invites Sent',
  blurb:
    'An admin invited someone to a team by email. The invitation, not the acceptance: that is the next card.',
};
export const INVITES_ACCEPTED: Metric = {
  category: 'Team',
  action: 'Joined',
  type: null,
  title: 'Invites Accepted',
  blurb: 'Someone joined a team, by accepting an email invite or opening an invite link.',
};
export const INVITES_DECLINED: Metric = {
  category: 'Team',
  action: 'Declined',
  type: 'Invite',
  rising: 'neutral',
  title: 'Invites Declined',
  blurb: 'The recipient turned an invitation down. Read against accepted, not against sent.',
};
export const DIAGRAMS_SHARED_TO_A_TEAM: Metric = {
  category: 'Team',
  action: 'Added',
  type: 'Diagram',
  title: 'Diagrams Shared to a Team',
  blurb: "A diagram was moved into a team's shared library for everyone on the team.",
};
export const VOTES_STARTED: Metric = {
  category: 'Tab',
  action: 'Started',
  type: 'Vote',
  title: 'Votes Started',
  blurb: 'A facilitator opened a dot-vote on a tab.',
};
export const PRIVATE_VOTES: Metric = {
  category: 'Tab',
  action: 'Started',
  type: 'PrivateVote',
  title: 'Private Votes',
  blurb:
    'Votes started with hidden cursors or hidden running counts. Part of Votes Started, not a separate vote.',
};
export const DOTS_CAST: Metric = {
  category: 'Element',
  action: 'Voted',
  type: null,
  title: 'Dots Cast',
  blurb: 'A participant placed a dot on an element.',
};
export const DOTS_RETRACTED: Metric = {
  category: 'Element',
  action: 'Removed',
  type: 'Vote',
  rising: 'neutral',
  title: 'Dots Retracted',
  blurb:
    'A participant took a dot back. Read against dots cast to see how much reconsidering happens.',
};
export const RESULTS_REVEALED: Metric = {
  category: 'Tab',
  action: 'Revealed',
  type: 'Vote',
  title: 'Results Revealed',
  blurb:
    'The facilitator showed the tallies. A vote started but never revealed is one that fizzled.',
};
export const VOTES_DISCARDED: Metric = {
  category: 'Tab',
  action: 'Cleared',
  type: 'Vote',
  rising: 'neutral',
  title: 'Votes Discarded',
  blurb:
    'The whole round was thrown away, dots and all. Distinct from ending it, which keeps the tallies.',
};
export const POLLS_STARTED: Metric = {
  category: 'Tab',
  action: 'Started',
  type: 'Poll',
  title: 'Polls Started',
  blurb: 'A live pulse-check was opened on a tab (spec/88). Nothing about a poll is persisted.',
};
export const POLL_ANSWERS: Metric = {
  category: 'Tab',
  action: 'Voted',
  type: 'Poll',
  title: 'Poll Answers',
  blurb: 'A participant answered. Read against polls started for average turnout.',
};
export const POLLS_ENDED: Metric = {
  category: 'Tab',
  action: 'Ended',
  type: 'Poll',
  title: 'Polls Ended',
  blurb: 'The facilitator closed the poll.',
};
export const COUNTDOWNS_STARTED: Metric = {
  category: 'Tab',
  action: 'Started',
  type: 'CountdownTimer',
  title: 'Countdowns Started',
  blurb: 'A timebox was set running on a tab.',
};
export const STOPWATCHES_STARTED: Metric = {
  category: 'Tab',
  action: 'Started',
  type: 'StopwatchTimer',
  title: 'Stopwatches Started',
  blurb: 'A count-up timer was set running.',
};
export const TIMERS_PAUSED: Metric = {
  category: 'Tab',
  action: 'Toggled',
  type: 'TimerPaused',
  rising: 'neutral',
  title: 'Timers Paused',
  blurb:
    'Countdowns and stopwatches together: the editor does not say which. Paused mid-run. Heavy pausing suggests the timebox rarely survives contact with the meeting.',
};
export const TIMERS_RESET: Metric = {
  category: 'Tab',
  action: 'Changed',
  type: 'TimerReset',
  rising: 'neutral',
  title: 'Timers Reset',
  blurb:
    'Countdowns and stopwatches together: the editor does not say which. Returned to its starting value, usually for a second round of the same exercise.',
};
export const TIMERS_EXTENDED: Metric = {
  category: 'Tab',
  action: 'Changed',
  type: 'TimerExtended',
  title: 'Timers Extended',
  blurb:
    'More time added to a running countdown. Frequent extensions mean the timebox was set too tight.',
};
export const COUNTDOWNS_FINISHED: Metric = {
  category: 'Tab',
  action: 'Ended',
  type: 'CountdownTimer',
  title: 'Countdowns Finished',
  blurb: 'Dismissed from the tab. Read against countdowns started to see how many get abandoned.',
};
export const STOPWATCHES_FINISHED: Metric = {
  category: 'Tab',
  action: 'Ended',
  type: 'StopwatchTimer',
  title: 'Stopwatches Finished',
  blurb: 'Dismissed from the tab.',
};

export const LIVE_TOGETHER: MetricStack = {
  stack: true,
  title: 'Live Together',
  blurb: 'Two or more people on one canvas at the same moment, and sessions being presented.',
  members: [
    MULTIPLAYER_SESSIONS,
    VIEWPORTS_FOLLOWED,
    FACILITATOR_CLAIMED,
    FACILITATOR_RELEASED,
    AVATARS_CUSTOMISED,
    FACILITATOR_CONTROLS,
  ],
  headline: MULTIPLAYER_SESSIONS,
};
export const SHARING_AND_JOINING: MetricStack = {
  stack: true,
  title: 'Sharing & Joining',
  blurb: 'Edit and view links made, and the people who came in through them.',
  members: [
    EDIT_LINKS_SHARED,
    VIEW_LINKS_SHARED,
    COLLABORATORS_JOINED,
    VIEWERS_JOINED,
    SHARE_LINKS_COPIED,
    SHARE_SETTINGS,
    SHARE_LINKS_REMOVED,
    EMBEDS_VIEWED,
    LIVE_IMAGE_TABS,
  ],
  headline: [COLLABORATORS_JOINED, VIEWERS_JOINED],
};
export const DISCUSSION: MetricStack = {
  stack: true,
  title: 'Discussion',
  blurb: 'Comments left on elements, opened to read or reply, and resolved.',
  members: [
    COMMENTS_ADDED,
    COMMENT_POPOVERS_OPENED,
    COMMENTS_RESOLVED,
    COMMENTS_REOPENED,
    COMMENTS_DELETED,
  ],
  headline: COMMENTS_ADDED,
};
export const TEAM_ACTIVITY: MetricStack = {
  stack: true,
  title: 'Team Activity',
  blurb: 'Teams made, the invite funnel (sent, accepted, declined), and diagrams shared to a team.',
  members: [
    TEAMS_CREATED,
    INVITES_SENT,
    INVITES_ACCEPTED,
    INVITES_DECLINED,
    DIAGRAMS_SHARED_TO_A_TEAM,
    TEAM_DIAGRAMS_MOVED,
    INVITE_LINKS_SHARED,
    TEAM_CHANGES,
    TEAM_REMOVALS,
    TEAMS_DELETED,
  ],
  headline: INVITES_ACCEPTED,
};
export const VOTING: MetricStack = {
  stack: true,
  title: 'Voting',
  blurb: 'Dot-votes run on a tab: started, private, dots cast and taken back, revealed, discarded.',
  members: [
    VOTES_STARTED,
    PRIVATE_VOTES,
    DOTS_CAST,
    DOTS_RETRACTED,
    RESULTS_REVEALED,
    VOTES_DISCARDED,
    VOTES_ENDED,
    VOTE_REVIEWS_ENDED,
  ],
  headline: VOTES_STARTED,
};
export const POLLS: MetricStack = {
  stack: true,
  title: 'Polls',
  blurb: 'Live pulse-checks opened, answered, and closed.',
  members: [POLLS_STARTED, POLL_ANSWERS, POLLS_ENDED],
  headline: POLLS_STARTED,
};
// Countdowns and stopwatches are different tools, so different stacks. The
// editor reports Paused and Reset without saying which kind (useTabSession
// tracks the gesture, not the mode), so those two sit in both stacks, each
// saying so; the headlines count starts, so nothing is summed twice.
export const COUNTDOWNS: MetricStack = {
  stack: true,
  title: 'Countdowns',
  blurb: 'Timeboxes set running on a tab, extended, and finished.',
  members: [
    COUNTDOWNS_STARTED,
    TIMERS_EXTENDED,
    COUNTDOWNS_FINISHED,
    TIMERS_PAUSED,
    TIMERS_RESET,
    TIMERS_RESUMED,
  ],
  headline: COUNTDOWNS_STARTED,
};
export const STOPWATCHES: MetricStack = {
  stack: true,
  title: 'Stopwatches',
  blurb: 'Count-up timers set running on a tab, and finished.',
  members: [STOPWATCHES_STARTED, STOPWATCHES_FINISHED, TIMERS_PAUSED, TIMERS_RESET, TIMERS_RESUMED],
  headline: STOPWATCHES_STARTED,
};

// ---- Editing tab -------------------------------------------------------------
// Tools that organise the work rather than draw it. Tab folders (spec/30) are
// typed rather than bare because the bare Tab/Folder events belong to
// different subjects: see the type note in spec/22's Folder entry.

export const NOTES_ADDED: Metric = {
  category: 'Note',
  action: 'Added',
  type: null,
  title: 'Notes Added',
  blurb: "An element's note went from empty to written (spec/22).",
};
export const NOTES_OPENED: Metric = {
  category: 'Note',
  action: 'Opened',
  type: null,
  title: 'Notes Opened',
  blurb: 'The note popover was opened, to read as well as to write.',
};
export const ACTIONS_ASSIGNED: Metric = {
  category: 'Action',
  action: 'Created',
  allTypes: true,
  title: 'Actions Assigned',
  blurb:
    'Element-level work assigned to a teammate (spec/68), with or without the email notification.',
};
export const ACTIONS_EMAILED: Metric = {
  category: 'Action',
  action: 'Created',
  type: 'EmailOn',
  title: 'Actions Emailed',
  blurb:
    'Actions assigned with the notify-by-email box ticked. Part of Actions Assigned. Counts the box, not a sent email: sends are Action Notifications in the Emails Sent stack on the Dashboard.',
};
export const ACTIONS_COMPLETED: Metric = {
  category: 'Action',
  action: 'Resolved',
  type: null,
  title: 'Actions Completed',
  blurb: 'Read against actions assigned: the follow-through rate on the feature.',
};
export const FOLDERS_CREATED: Metric = {
  category: 'Folder',
  action: 'Created',
  typeIn: (type) => type !== 'Tab',
  title: 'Folders Created',
  blurb: 'Folders of diagrams, in your own Explorer or a team library.',
};
export const FOLDERS_RE_PARENTED: Metric = {
  category: 'Folder',
  action: 'Moved',
  allTypes: true,
  title: 'Folders Re-parented',
  blurb: 'A folder nested under another, or promoted back to the root.',
};
export const TAB_FOLDERS_CREATED: Metric = {
  category: 'Folder',
  action: 'Created',
  type: 'Tab',
  title: 'Tab Folders Created',
  blurb: 'A collapsible folder of tab pills created inside one diagram.',
};
export const TABS_FILED: Metric = {
  category: 'Tab',
  action: 'Moved',
  type: 'Folder',
  title: 'Tabs Filed',
  blurb:
    'A tab filed into a tab folder, by the ellipsis menu or by a drag (both report identically).',
};
export const DIAGRAMS_FILED: Metric = {
  category: 'Diagram',
  action: 'Moved',
  allTypes: true,
  title: 'Diagrams Filed',
  blurb:
    'A diagram moved into a folder, back to Unsorted, or between the cloud and offline storage (spec/76).',
};

export const NOTES: MetricStack = {
  stack: true,
  title: 'Notes',
  blurb: 'Notes written on elements, and opened to read or edit.',
  members: [NOTES_ADDED, NOTES_OPENED, NOTES_DELETED, NOTES_EDITED, NOTE_FORMATTING],
  headline: NOTES_ADDED,
};
export const ASSIGNED_ACTIONS: MetricStack = {
  stack: true,
  title: 'Assigned Actions',
  blurb: 'Element-level work assigned to a teammate (spec/68), emailed about, and completed.',
  members: [
    ACTIONS_ASSIGNED,
    ACTIONS_EMAILED,
    ACTIONS_COMPLETED,
    ACTIONS_EDITED,
    ACTIONS_OPENED,
    ACTIONS_DELETED,
    ACTIONS_REOPENED,
    ACTIONS_MOVED_TO_TEAM,
  ],
  headline: ACTIONS_ASSIGNED,
};
export const ORGANISATION: MetricStack = {
  stack: true,
  title: 'Organisation',
  blurb: 'Folders made and nested, tab folders, and tabs and diagrams filed.',
  members: [
    FOLDERS_CREATED,
    FOLDERS_RE_PARENTED,
    TAB_FOLDERS_CREATED,
    TABS_FILED,
    DIAGRAMS_FILED,
    FOLDERS_DELETED,
    FOLDERS_RENAMED,
    TABS_UNFILED,
  ],
};

// ---- Settings tab ------------------------------------------------------------
// One chart per row of the editor's Settings dialog, one stack per Settings
// category (apps/live settings-catalogue.ts, in its order). Every row emits
// generically from SettingsCategoryPane: a toggle `Toggled·<X>On` / `<X>Off`,
// a choice `Changed·<X><Option>`, a slider `Changed·<X>`. Each chart counts
// every change to its setting, both directions, so whether a setting is
// flipped at all reads at a glance; which way it went is in Search. Neutral:
// a changed setting is neither good nor bad. `metric-emitters.test` fails if a
// Settings row has no chart here.
const toggle = (
  category: string,
  on: string,
  off: string,
  title: string,
  blurb: string,
): Metric => ({
  category,
  action: 'Toggled',
  typeIn: (type) => type === on || type === off,
  title,
  blurb,
  rising: 'neutral',
});
const changed = (prefix: string, title: string, blurb: string, exact = false): Metric => ({
  category: 'UI',
  action: 'Changed',
  typeIn: (type) => (exact ? type === prefix : (type ?? '').startsWith(prefix)),
  title,
  blurb,
  rising: 'neutral',
});
const settingsStack = (title: string, blurb: string, members: Metric[]): MetricStack => ({
  stack: true,
  title,
  blurb,
  members,
  rising: 'neutral',
});

export const EDITOR_SETTINGS = settingsStack(
  'Editor Settings',
  'How the canvas behaves while you draw.',
  [
    toggle(
      'UI',
      'QuickAddHoverOn',
      'QuickAddHoverOff',
      'Quick-Add on Hover',
      'Hover handles that add a connected shape.',
    ),
    toggle(
      'UI',
      'AlignmentGuidesOn',
      'AlignmentGuidesOff',
      'Alignment Guides',
      'Snap guides while dragging.',
    ),
    toggle(
      'UI',
      'AutoRebindOn',
      'AutoRebindOff',
      'Auto-Attach Arrows',
      'Arrows re-attaching to the nearest shape.',
    ),
  ],
);
export const APPEARANCE_SETTINGS = settingsStack('Appearance Settings', 'How the editor looks.', [
  {
    category: 'UI',
    action: 'Toggled',
    typeIn: (type) => type === 'Light' || type === 'Dark' || type === 'System',
    title: 'Theme',
    blurb: 'Light, Dark or System picked, from the header toggle or Settings.',
    rising: 'neutral',
  },
  changed('PanelLayout', 'Panel Layout', 'Floating, Minimal or Toolbar chrome.'),
  toggle('UI', 'MinimapOn', 'MinimapOff', 'Show Minimap', 'The minimap in the corner.'),
  changed('PanelOpacity', 'Panel Opacity', 'The panels\u2019 transparency slider.', true),
]);
export const CONTROLS_SETTINGS = settingsStack(
  'Controls Settings',
  'Mouse and trackpad behaviour.',
  [
    toggle(
      'UI',
      'MiddleMousePanOn',
      'MiddleMousePanOff',
      'Middle-Mouse Pan',
      'Panning with the middle mouse button.',
    ),
  ],
);
export const KEYBOARD_SETTINGS = settingsStack(
  'Keyboard Settings',
  'Keyboard shortcuts on or off.',
  [
    toggle(
      'UI',
      'ShortcutsOn',
      'ShortcutsOff',
      'Keyboard Shortcuts',
      'Single-key shortcuts switched on or off, for this device.',
    ),
  ],
);
export const PANELS_SETTINGS = settingsStack(
  'Panels Settings',
  'What the Layers, Activity and minimap panels show.',
  [
    toggle(
      'UI',
      'LayerPreviewOn',
      'LayerPreviewOff',
      'Layer Thumbnails',
      'Thumbnails in the Layers panel.',
    ),
    toggle(
      'UI',
      'LayerCountOn',
      'LayerCountOff',
      'Layer Element Counts',
      'Element counts on each layer.',
    ),
    toggle(
      'UI',
      'LayerHoverPreviewOn',
      'LayerHoverPreviewOff',
      'Preview Layer on Hover',
      'Highlighting a layer\u2019s elements on hover.',
    ),
    toggle(
      'UI',
      'ActivityRevertPreviewOn',
      'ActivityRevertPreviewOff',
      'Preview Revert on Hover',
      'Previewing a revert from the Activity panel.',
    ),
    toggle(
      'UI',
      'MapDimOn',
      'MapDimOff',
      'Dim Outside the View',
      'The minimap dimming what is off screen.',
    ),
    changed('MapSize', 'Minimap Size', 'Short, Medium or Tall.'),
  ],
);
export const NOTIFICATION_SETTINGS = settingsStack(
  'Notification Settings',
  'In-editor notifications and each email opt-out.',
  [
    toggle(
      'UI',
      'NotificationsOn',
      'NotificationsOff',
      'In-Editor Notifications',
      'Toasts and the notification bell.',
    ),
    toggle(
      'UI',
      'NotifyDiagramJoinOn',
      'NotifyDiagramJoinOff',
      'Someone Joins My Diagram',
      'The diagram-joined email.',
    ),
    toggle(
      'UI',
      'NotifyInviteResponseOn',
      'NotifyInviteResponseOff',
      'Someone Responds to a Team Invite',
      'The invite-response email.',
    ),
    toggle(
      'UI',
      'NotifyCommentsOn',
      'NotifyCommentsOff',
      'Someone Comments on My Diagram',
      'The new-comment email.',
    ),
    toggle(
      'UI',
      'NotifyActionAssignedOn',
      'NotifyActionAssignedOff',
      'Someone Assigns Me an Action',
      'The action-assigned email.',
    ),
    toggle(
      'UI',
      'NotifyTipsOn',
      'NotifyTipsOff',
      'Tips and Check-Ins',
      'The onboarding and win-back emails.',
    ),
    toggle(
      'UI',
      'NotifyMilestonesOn',
      'NotifyMilestonesOff',
      'Milestones',
      'The milestone and first-share emails.',
    ),
  ],
);
export const ACCESSIBILITY_SETTINGS = settingsStack(
  'Accessibility Settings',
  'Motion and the welcome tour.',
  [
    toggle('UI', 'ReduceMotionOn', 'ReduceMotionOff', 'Reduce Motion', 'Turning animation down.'),
    toggle(
      'UI',
      'TourSeenOff',
      'TourSeenOn',
      'Show Welcome Tour',
      'The welcome tour switched back on or off.',
    ),
  ],
);
export const AI_SETTINGS = settingsStack(
  'AI Tools Settings',
  'The AI assistant opt-in and its suggestions.',
  [
    toggle(
      'AI',
      'AiOn',
      'AiOff',
      'AI Assistant',
      'The AI assistant opt-in, switched on or off. AI is off until someone turns it on, so every AI request comes from people who did.',
    ),
    toggle(
      'AI',
      'AiSuggestedPromptsOn',
      'AiSuggestedPromptsOff',
      'Suggested Prompts',
      'Prompt suggestions in the AI panel.',
    ),
  ],
);
export const PRIVACY_SETTINGS = settingsStack(
  'Privacy Settings',
  'Anonymous usage events, the thing this dashboard counts.',
  [
    toggle(
      'UI',
      'TelemetryOn',
      'TelemetryOff',
      'Send Anonymous Usage Events',
      'The opt-out, fired before it takes effect so the change still arrives.',
    ),
  ],
);

export const SETTINGS_STACKS: readonly MetricStack[] = [
  EDITOR_SETTINGS,
  APPEARANCE_SETTINGS,
  CONTROLS_SETTINGS,
  KEYBOARD_SETTINGS,
  PANELS_SETTINGS,
  NOTIFICATION_SETTINGS,
  ACCESSIBILITY_SETTINGS,
  AI_SETTINGS,
  PRIVACY_SETTINGS,
];

// ---- Every other event, so nothing lands only in Search (spec/22) ----------
// `metric-emitters.test` fails if an event the repo can send has no chart.

// Element editing: everything done to an element after it is placed.
export const ELEMENTS_CHANGED = chart(
  'Element',
  'Changed',
  'Elements Changed',
  'Restyled or edited: colour, text, arrow ends, size, presets, the format painter and more.',
);
export const ELEMENTS_DELETED = chart(
  'Element',
  'Deleted',
  'Elements Deleted',
  'Elements removed, table rows and columns included. One per gesture, however many it took.',
  { rising: 'neutral' },
);
export const ELEMENTS_DUPLICATED = chart(
  'Element',
  'Duplicated',
  'Elements Duplicated',
  'A duplicate made in place.',
);
export const ELEMENTS_COPIED = chart(
  'Element',
  'Copied',
  'Elements Copied',
  'Copied to the clipboard.',
);
export const ARROW_ENDS_ATTACHED = chart(
  'Element',
  'Linked',
  'Arrow Ends Attached',
  'An arrow end dropped onto a shape so it follows it.',
);
export const ELEMENTS_REORDERED = chart(
  'Element',
  'Reordered',
  'Elements Reordered',
  'Sent to the back or brought to the front.',
);
export const ELEMENT_OPTIONS_TOGGLED = chart(
  'Element',
  'Toggled',
  'Element Options Toggled',
  'Per-element switches: aspect lock, strikethrough, table zebra rows and header column.',
);
export const ELEMENTS_LOCKED = chart(
  'Element',
  'Locked',
  'Locked & Unlocked',
  'Elements locked in place or unlocked.',
  { actionIn: ['Unlocked'] },
);
export const ELEMENT_ACTIONS_USED = chart(
  'Element',
  'Used',
  'Element Actions Used',
  'One-off element actions, such as Bring into Focus.',
);
export const KEYBOARD_SELECTIONS = chart(
  'Element',
  'Selected',
  'Keyboard Selections',
  'Elements selected from the keyboard.',
);
export const INSERTED_BETWEEN = chart(
  'Canvas',
  'Used',
  'Inserted Between',
  'A shape dragged onto an arrow to insert it between two others.',
  { types: ['InsertBetween'] },
);

export const ELEMENT_EDITING: MetricStack = {
  stack: true,
  title: 'Element Editing',
  blurb:
    'Everything done to an element after it is placed: changed, deleted, copied, attached, reordered.',
  members: [
    ELEMENTS_CHANGED,
    ELEMENTS_DELETED,
    ELEMENTS_DUPLICATED,
    ELEMENTS_COPIED,
    ARROW_ENDS_ATTACHED,
    ELEMENTS_REORDERED,
    ELEMENT_OPTIONS_TOGGLED,
    ELEMENTS_LOCKED,
    ELEMENT_ACTIONS_USED,
    KEYBOARD_SELECTIONS,
    INSERTED_BETWEEN,
    LINKS_REMOVED,
  ],
};

// Undo, redo and revert.
export const UNDOS = chart('Diagram', 'Undone', 'Undos', 'A change undone.', { rising: 'neutral' });
export const REDOS = chart('Diagram', 'Redone', 'Redos', 'An undo redone.', { rising: 'neutral' });
export const REVERTS = chart(
  'Diagram',
  'Reverted',
  'Reverts',
  'A diagram rolled back to an earlier point from the Activity panel.',
  { rising: 'neutral' },
);
export const UNDO_AND_REVERT: MetricStack = {
  stack: true,
  title: 'Undo & Revert',
  blurb: 'Changes taken back: undone, redone, or rolled back from the Activity panel.',
  members: [UNDOS, REDOS, REVERTS],
  rising: 'neutral',
};

// The Explorer Timeline (spec/138) and the editor's Activity panel.
export const TIMELINE_OPENED = chart(
  'Timeline',
  'Opened',
  'Timeline Opened',
  'The Explorer Timeline feed opened, from its landing, a stack, a menu or the nav.',
);
export const TIMELINE_ENTRIES_REMOVED = chart(
  'Timeline',
  'Removed',
  'Timeline Entries Removed',
  'An entry or a whole stack removed from the feed.',
  { rising: 'neutral' },
);
export const ACTIVITY_OPENED = chart(
  'Activity',
  'Opened',
  'Activity Opened',
  'The editor Activity panel opened.',
);
export const ACTIVITY_THREADS = chart(
  'Activity',
  'Selected',
  'Activity Items Opened',
  'An item in the Activity panel opened.',
);
export const TIMELINE_AND_ACTIVITY: MetricStack = {
  stack: true,
  title: 'Timeline & Activity',
  blurb: 'Keeping up with what changed: the Explorer Timeline and the editor Activity panel.',
  members: [
    TIMELINE_OPENED,
    TIMELINE_ENTRIES_REMOVED,
    ACTIVITY_OPENED,
    ACTIVITY_THREADS,
    TIMELINE_LOADS,
    TIMELINE_VIEW_SWITCHED,
    TIMELINE_FILTERED,
    FEED_RETRIES,
  ],
};

// Export and import.
export const EXPORT_OPTIONS = chart(
  'UI',
  'Toggled',
  'Export Options',
  'Image export options: the canvas pattern, the isometric view, hidden layers.',
  { types: ['PatternExport', 'IsometricExport', 'HiddenLayersExport'] },
);
export const TAB_IMPORTS = chart(
  'Tab',
  'Imported',
  'Tabs Imported',
  'A tab imported from Mermaid, Excalidraw, JSON or Markdown.',
);
export const EXPORT_AND_IMPORT: MetricStack = {
  stack: true,
  title: 'Export & Import',
  blurb: 'Diagrams leaving livediagram as files and text, and tabs coming in from other tools.',
  members: [EXPORTS, EXPORT_OPTIONS, TAB_IMPORTS],
};

// The editor's search panel.
export const SEARCH_OPENED = chart(
  'Search',
  'Opened',
  'Search Opened',
  'The editor search panel opened.',
);
export const SEARCH_QUERIES = chart(
  'Search',
  'Searched',
  'Searches',
  'A query typed into the panel, once per open.',
);
export const SEARCH_RESULTS_PICKED = chart(
  'Search',
  'Selected',
  'Results Picked',
  'A command, element or help result chosen.',
);
export const EDITOR_SEARCH: MetricStack = {
  stack: true,
  title: 'Editor Search',
  blurb: 'The search panel: opened, searched, and a result picked.',
  members: [SEARCH_OPENED, SEARCH_QUERIES, SEARCH_RESULTS_PICKED],
  headline: SEARCH_OPENED,
};

// The palette beyond adding elements (Palette tab has the rankings).
export const PALETTE_FAVOURITES = chart(
  'UI',
  'Added',
  'Palette Favourites',
  'Favourites added, removed, reordered, or the editor opened.',
  {
    actionIn: ['Removed', 'Changed', 'Toggled'],
    typeIn: (type) => (type ?? '').startsWith('PaletteFavourite'),
  },
);
export const PALETTE_SEARCHES = chart(
  'UI',
  'Searched',
  'Palette Searches',
  'Searches inside the palette, its icons, technology marks and behaviours.',
);
export const PALETTE_GROUPS_OPENED = chart(
  'UI',
  'Opened',
  'Palette Groups Opened',
  'A palette group or toolbar overflow opened.',
  {
    typeIn: (type) =>
      (type ?? '').endsWith('Group') || type === 'ToolbarMore' || type === 'ToolbarExplorer',
  },
);
export const TOOLBAR_CATEGORY = chart(
  'UI',
  'Changed',
  'Toolbar Category',
  'The Toolbar layout switched to another category.',
  { types: ['ToolbarCategory'] },
);
export const SELECTION_MODES_USED = chart(
  'Canvas',
  'Used',
  'Selection Modes Used',
  'Laser, spotlight, eraser, highlighter, format painter, isometric and avatar modes.',
  { types: SELECTION_MODES },
);
export const PALETTE_USE: MetricStack = {
  stack: true,
  title: 'Palette Use',
  blurb:
    'How the palette gets used beyond adding elements: favourites, searches, groups, and canvas modes.',
  members: [
    PALETTE_FAVOURITES,
    PALETTE_SEARCHES,
    PALETTE_GROUPS_OPENED,
    TOOLBAR_CATEGORY,
    SELECTION_MODES_USED,
    MODE_OPTIONS,
  ],
  seeAlso: { view: 'palette', label: 'See Each Mode on the Palette Tab' },
};

// Editor chrome: layout and navigation.
export const CANVAS_ZOOMS = chart(
  'Canvas',
  'Zoomed',
  'Canvas Zooms',
  'Zoomed in or out, to fit, or to a preset.',
);
export const ZEN_MODE = chart('UI', 'Toggled', 'Zen Mode', 'Zen mode switched on or off.', {
  types: ['ZenModeOn', 'ZenModeOff'],
  rising: 'neutral',
});
export const MINIMAL_PANELS = chart(
  'UI',
  'Toggled',
  'Minimal Panels',
  'The panels collapsed to their minimal form, or back.',
  { types: ['MinimalPanelsOn', 'MinimalPanelsOff'], rising: 'neutral' },
);
export const PANELS_DOCKED = chart('UI', 'Moved', 'Panels Docked', 'A panel docked or undocked.', {
  rising: 'neutral',
});
export const EXPLORER_VIEW = chart(
  'UI',
  'Toggled',
  'Explorer View',
  'The Explorer switched between cards and a list.',
  { typeIn: (type) => (type ?? '').startsWith('ExplorerView'), rising: 'neutral' },
);
export const EDITOR_CHROME: MetricStack = {
  stack: true,
  title: 'Editor Chrome',
  blurb:
    'Getting around and arranging the workspace: zoom, zen mode, panel layout, the Explorer view.',
  members: [CANVAS_ZOOMS, ZEN_MODE, MINIMAL_PANELS, PANELS_DOCKED, EXPLORER_VIEW],
};

// Dialogs and panels opened (UI·Opened), split by what was opened.
const OPENED_HOMES: ((type: string | null) => boolean)[] = [];
const opened = (title: string, blurb: string, typeIn: (type: string | null) => boolean): Metric => {
  OPENED_HOMES.push(typeIn);
  return chart('UI', 'Opened', title, blurb, { typeIn });
};
export const SETTINGS_OPENED = opened(
  'Settings Opened',
  'The Settings dialog, or one of its categories, opened.',
  (t) => (t ?? '').startsWith('Settings'),
);
export const SHARE_OPENED = opened(
  'Share Opened',
  'The Share dialog or the collaborators list opened.',
  (t) => t === 'Share' || t === 'Collaborators',
);
export const PICKERS_OPENED = opened(
  'Theme & Canvas Pickers',
  'The theme picker or the canvas style panel opened.',
  (t) => t === 'ThemePicker' || t === 'CanvasStyle',
);
export const HELP_FROM_EDITOR = opened(
  'Help from the Editor',
  'A help article opened from inside the editor.',
  (t) => /^[a-z]/.test(t ?? ''),
);
export const SHORTCUTS_OPENED = opened(
  'Shortcuts Opened',
  'The keyboard shortcuts list opened.',
  (t) => t === 'Shortcuts',
);
export const ACTIVITY_PANEL_OPENED = opened(
  'Activity Panel Opened',
  'The Activity panel opened from the chrome.',
  (t) => t === 'Activity',
);
export const TOUR_OFFERED = opened(
  'Tour Offered',
  'The welcome tour offered.',
  (t) => t === 'TourOffer',
);
export const SLIDE_DECK_OPENED = opened(
  'Slide Deck Opened',
  'The Slide Deck panel or presentation settings opened.',
  (t) => t === 'SlideDeck' || t === 'PresentationSettings',
);
export const SIGN_IN_REASONS = opened(
  'Sign-In Reasons Shown',
  'Why-sign-in reasons or an action sign-in nudge shown.',
  (t) => t === 'SignInReasons' || t === 'ActionSignInNudge',
);
OPENED_HOMES.push(PALETTE_GROUPS_OPENED.typeIn!);
export const OTHER_OPENED = chart(
  'UI',
  'Opened',
  'Other Panels Opened',
  'Any other dialog or panel opened.',
  { typeIn: (t) => !OPENED_HOMES.some((home) => home(t)) },
);
export const PANELS_OPENED: MetricStack = {
  stack: true,
  title: 'Dialogs & Panels',
  blurb: 'Which dialogs and panels people open, from Settings and Share to help articles.',
  members: [
    SETTINGS_OPENED,
    SHARE_OPENED,
    PICKERS_OPENED,
    HELP_FROM_EDITOR,
    SHORTCUTS_OPENED,
    ACTIVITY_PANEL_OPENED,
    OTHER_OPENED,
  ],
};

// The welcome tour.
export const TOUR_OFFER_DISMISSED = chart(
  'UI',
  'Closed',
  'Tour Offer Dismissed',
  'The tour offer closed without starting.',
  { types: ['TourOffer'], rising: 'neutral' },
);
export const TOURS_STARTED = chart('UI', 'Started', 'Tours Started', 'The welcome tour started.', {
  types: ['Tour'],
});
export const TOUR_STEPS_VIEWED = chart(
  'UI',
  'View',
  'Tour Steps Viewed',
  'A step of the tour shown.',
  { typeIn: (t) => (t ?? '').startsWith('TourStep') },
);
export const TOURS_COMPLETED = chart(
  'UI',
  'Ended',
  'Tours Completed',
  'The tour run to its last step.',
  { types: ['TourCompleted'] },
);
export const TOURS_SKIPPED = chart(
  'UI',
  'Ended',
  'Tours Skipped',
  'The tour closed before its end.',
  { types: ['TourSkipped'], rising: 'neutral' },
);
export const WELCOME_TOUR: MetricStack = {
  stack: true,
  title: 'Welcome Tour',
  blurb: 'The tour offered, started, stepped through, finished or skipped.',
  members: [
    TOUR_OFFERED,
    TOUR_OFFER_DISMISSED,
    TOURS_STARTED,
    TOUR_STEPS_VIEWED,
    TOURS_COMPLETED,
    TOURS_SKIPPED,
    TOURS_DECLINED,
  ],
  headline: TOURS_STARTED,
};

// Presentations (spec/31).
export const PRESENTATIONS_STARTED = chart(
  'UI',
  'Started',
  'Presentations Started',
  'A slide deck presented full screen.',
  { types: ['Presentation'] },
);
export const PRESENTATIONS_CLOSED = chart(
  'UI',
  'Closed',
  'Presentations Closed',
  'A presentation ended.',
  { types: ['Presentation'] },
);
export const SLIDES_ADDED = chart('UI', 'Added', 'Slides Added', 'A slide added to a deck.', {
  types: ['Slide'],
});
export const SLIDES_REMOVED = chart(
  'UI',
  'Removed',
  'Slides Removed',
  'A slide taken out of a deck.',
  { types: ['Slide'], rising: 'neutral' },
);
export const SLIDES_SHOWN_HIDDEN = chart(
  'UI',
  'Toggled',
  'Slides Shown & Hidden',
  'A slide hidden from the deck or shown again.',
  { types: ['SlideShown', 'SlideHidden'], rising: 'neutral' },
);
export const PRESENTATIONS: MetricStack = {
  stack: true,
  title: 'Presentations',
  blurb: 'Slide decks built from element sets and presented full screen.',
  members: [
    PRESENTATIONS_STARTED,
    PRESENTATIONS_CLOSED,
    SLIDE_DECK_OPENED,
    SLIDES_ADDED,
    SLIDES_REMOVED,
    SLIDES_SHOWN_HIDDEN,
    SLIDE_NOTES,
  ],
  headline: PRESENTATIONS_STARTED,
};

// Sign-in prompts.
export const SIGN_IN_BANNER_DISMISSED = chart(
  'UI',
  'Closed',
  'Sign-In Banner Dismissed',
  'The sign-in banner closed.',
  { types: ['SignInBanner'], rising: 'neutral' },
);
export const SIGN_IN_BANNER_CLICKED = chart(
  'UI',
  'Selected',
  'Sign-In Banner Clicked',
  'The sign-in banner followed through.',
  { types: ['SignInBanner'] },
);
export const WELCOME_DISMISSED = chart(
  'UI',
  'Closed',
  'Welcome Dismissed',
  'The first-visit welcome closed.',
  { types: ['Welcome'], rising: 'neutral' },
);
export const SIGN_IN_PROMPTS: MetricStack = {
  stack: true,
  title: 'Sign-In Prompts',
  blurb: 'The nudges to make an account: the banner, the reasons, and the first-visit welcome.',
  members: [SIGN_IN_BANNER_CLICKED, SIGN_IN_BANNER_DISMISSED, SIGN_IN_REASONS, WELCOME_DISMISSED],
  headline: SIGN_IN_BANNER_CLICKED,
};

// Help centre (Help tab has the rankings).
export const ARTICLE_VIEWS = chart(
  'Help',
  'View',
  'Article Views',
  'Help-centre articles opened, across every article.',
);
export const MARKED_HELPFUL = chart(
  'Help',
  'Helpful',
  'Marked Helpful',
  'Readers who tapped "yes, this helped" on an article.',
);
export const MARKED_NOT_HELPFUL = chart(
  'Help',
  'Unhelpful',
  'Marked Not Helpful',
  'Readers who tapped "not really": the articles worth rewriting.',
  { rising: 'bad' },
);
export const HELP_SEARCHES = chart(
  'Help',
  'Searched',
  'Help Searches',
  'Searches in the help centre that found something.',
  { types: ['Results'] },
);
export const DRY_HELP_SEARCHES = chart(
  'Help',
  'Searched',
  'Dry Help Searches',
  'Help searches that found nothing: the articles that do not exist yet.',
  { types: ['NoResults'], rising: 'bad' },
);
export const HELP_CENTRE: MetricStack = {
  stack: true,
  title: 'Help Centre',
  blurb: 'Articles read, votes cast on them, and what people searched for.',
  members: [ARTICLE_VIEWS, MARKED_HELPFUL, MARKED_NOT_HELPFUL, HELP_SEARCHES, DRY_HELP_SEARCHES],
  headline: ARTICLE_VIEWS,
  seeAlso: { view: 'help', label: 'See Each Article on the Help Tab' },
};

// Look and feel (Look & Feel tab has the rankings).
export const TEMPLATES_USED = chart(
  'Template',
  'Used',
  'Templates Used',
  'A template picked to start a diagram or seed a tab.',
);
export const THEMES_CHOSEN = chart(
  'Theme',
  'Changed',
  'Themes Chosen',
  'A built-in theme picked, at creation or later.',
  { typeIn: (t) => !CUSTOM_THEME_TYPES.has(t ?? '') },
);
export const CANVAS_STYLES_PICKED = chart(
  'Canvas',
  'Changed',
  'Canvas Styles Picked',
  'A background pattern picked for the canvas.',
  { typeIn: (t) => !NON_PATTERN_CANVAS_TYPES.includes(t ?? '') },
);
export const CANVAS_CONTROLS_TWEAKED = chart(
  'Canvas',
  'Changed',
  'Canvas Controls Tweaked',
  'The canvas colour, opacity, pattern colour, scale or animation speed changed.',
  { types: NON_PATTERN_CANVAS_TYPES, rising: 'neutral' },
);
export const CUSTOM_THEMES = chart(
  'Theme',
  'Created',
  'Custom Themes',
  'The custom-theme builder: created, applied, edited, deleted, and elements reset to their theme.',
  { actionIn: ['Changed', 'Deleted'], typeIn: (t) => CUSTOM_THEME_TYPES.has(t ?? '') },
);
export const LOOK_AND_FEEL: MetricStack = {
  stack: true,
  title: 'Look & Feel',
  blurb:
    'The visual presets people reach for: templates, themes, canvas styles, and their own themes.',
  members: [
    TEMPLATES_USED,
    THEMES_CHOSEN,
    CANVAS_STYLES_PICKED,
    CANVAS_CONTROLS_TWEAKED,
    CUSTOM_THEMES,
  ],
  headline: [TEMPLATES_USED, THEMES_CHOSEN, CANVAS_STYLES_PICKED],
  seeAlso: { view: 'lookfeel', label: 'See Each Preset on the Look & Feel Tab' },
};

// Settings changed, one chart per Settings category, for the Dashboard.
const categoryChart = (stack: MetricStack): Metric => {
  const first = stack.members[0]!;
  const actions = [...new Set(stack.members.map((m) => m.action))];
  return {
    category: first.category,
    action: actions[0]!,
    ...(actions.length > 1 ? { actionIn: actions.slice(1) } : {}),
    typeIn: (type) => stack.members.some((m) => m.typeIn?.(type)),
    title: stack.title.replace(/ Settings$/, ''),
    blurb: stack.blurb,
    rising: 'neutral',
  };
};
export const SETTINGS_CHANGED: MetricStack = {
  stack: true,
  title: 'Settings Changed',
  blurb: 'Changes in the editor’s Settings dialog, by category.',
  members: SETTINGS_STACKS.map(categoryChart),
  rising: 'neutral',
  seeAlso: { view: 'settings', label: 'See Each Setting on the Settings Tab' },
};

// Visitors and page views, for the Dashboard.
export const ALL_VISITORS: MetricStack = {
  stack: true,
  title: 'All Visitors',
  blurb:
    'Every browser that opened the app: first-timers and those back on a later day, counted once per day each, with the returners split by sign-in.',
  members: [NEW_VISITORS, RETURNING_VISITORS, RETURNING_GUESTS, RETURNING_SIGNED_IN],
  // The split is part of Returning Visitors, so it stays out of the total.
  headline: [NEW_VISITORS, RETURNING_VISITORS],
};
export const PAGE_VIEWS_BY_APP: MetricStack = {
  stack: true,
  title: 'Page Views by App',
  blurb:
    'Every page viewed across the site, by full load or in-app navigation, split by the app that serves it.',
  members: [MARKETING_PAGES, LIVE_PAGES, HELP_PAGES, DASHBOARD_PAGES],
  seeAlso: { view: 'pages', label: 'See Every Page on the Pages Tab' },
};
