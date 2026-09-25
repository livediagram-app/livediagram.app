import { PALETTE_TELEMETRY_TYPES, pageViewApp, type PageViewApp } from '@livediagram/api-schema';
import { isRecovery, isServerCrash } from './error-kinds';
import { canonicalElementType, PALETTE_KINDS, type PaletteTab } from './palette-types';
import type { Metric, MetricStack } from './metric-series';

// Charts defined once and reused (spec/22). A chart stack references these
// rather than declaring its own copies, so one chart can sit in several
// stacks, on several tabs, or on its own, and its wording stays in one place.

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
  category: 'Session',
  action: 'SignedOut',
  type: null,
  title: 'Sign-Outs',
};

export const ACCOUNTS_DELETED: Metric = {
  category: 'Session',
  action: 'Deleted',
  type: 'Account',
  title: 'Accounts Deleted',
  blurb: 'Signed-in users who deleted their account and all of its data.',
};

// Stacks shared by more than one tab, defined once like the charts above.
export const ACCOUNT_ACTIVITY: MetricStack = {
  stack: true,
  title: 'Account Activity',
  blurb:
    'Accounts made, signed into, signed out of, and deleted. Only fires where sign-in is configured.',
  members: [SIGN_UPS, SIGN_INS, SIGN_OUTS, ACCOUNTS_DELETED],
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
const email = (type: string, title: string, blurb: string): Metric => ({
  category: 'Email',
  action: 'Sent',
  type,
  title,
  blurb,
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
);
export const WIN_BACK_EMAILS = email(
  'WinBack',
  'Win-Back Emails',
  'An account that has gone quiet for about four weeks.',
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
);
export const ACCOUNT_DELETED_EMAILS = email(
  'AccountDeleted',
  'Account Deleted Emails',
  'The confirmation sent after someone deletes their account.',
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
  stack: true,
  title: 'Emails Sent',
  blurb:
    'Every transactional and lifecycle email that left the worker, one chart per template. The kind only, never a recipient.',
  members: [...EMAIL_KIND_METRICS],
};

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

// Parked: cleared from Highlights (September 2026) while it is rebuilt, and on
// no other tab as a card, so kept here with their wording ready to add back.
// Search and Raw still show the underlying events. (Elements Added came back
// as a stack.)

export const EXPORTS: Metric = {
  category: 'Diagram',
  action: 'Exported',
  allTypes: true,
  title: 'Exports',
  blurb:
    'A tab or selection exported, across every format (PNG, SVG, PDF, JSON, Mermaid, Markdown, Excalidraw). For the text formats, copying to the clipboard counts as an export too.',
};

export const DARK_MODE_SWITCHES: Metric = {
  category: 'UI',
  action: 'Toggled',
  type: 'Dark',
  title: 'Dark-Mode Switches',
  blurb: 'Someone set the editor appearance to Dark, from the header toggle or Settings.',
};

// The returning-visitor split by sign-in state, parked when the Acquisition
// tab was removed (September 2026): Returning Visitors sums both.
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

// The diagram + tab lifecycle as stacks (Highlights). Loaded is the opens
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
  ],
};

export const TAB_ACTIONS: MetricStack = {
  stack: true,
  title: 'Tab Actions',
  blurb: 'Tabs opened, made, renamed, deleted and duplicated.',
  members: [TABS_LOADED, TABS_CREATED, TABS_RENAMED, TABS_DELETED, TABS_DUPLICATED],
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
export const AI_TURNED_ON: Metric = {
  category: 'AI',
  action: 'Toggled',
  type: 'AiOn',
  title: 'AI Turned On',
  blurb:
    'The Settings opt-in being switched on. AI is off until someone turns it on, so every request comes from people who did this.',
};

export const AI_ASSISTANCE: MetricStack = {
  stack: true,
  title: 'AI Assistance',
  blurb: 'Requests in the editor AI panel, and how they split between Ask and Clean.',
  members: [AI_REQUESTS, AI_ASK, AI_CLEAN],
  headline: AI_REQUESTS,
};

// Programmatic access (Highlights, Connections): the API-token lifecycle and
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
  category: 'Token',
  action: 'Removed',
  type: null,
  title: 'Tokens Revoked',
  blurb: 'API tokens revoked, whether minted by hand or by an AI tool.',
};

export const API_TOKENS: MetricStack = {
  stack: true,
  title: 'API Tokens',
  blurb: 'Tokens minted by hand or by an AI tool connecting over MCP, and tokens revoked.',
  members: [TOKENS_CREATED, AI_TOOLS_CONNECTED, TOKENS_REVOKED],
  // Tokens minted; revocations are the same tokens leaving, not more of them.
  headline: [TOKENS_CREATED, AI_TOOLS_CONNECTED],
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
  members: [LAYERS_CREATED, LAYER_TOGGLES, LAYER_MOVES, LAYERS_DELETED, LAYERS_PANEL_OPENED],
};

// Error health (Exceptions tab). One side of each failure only: a server crash
// is reported twice, the api worker's Internal.<Method>.<Route> and the Http500
// its caller saw, so Failed Requests and Server Crashes are read side by side,
// never added.
export const FAILED_REQUESTS: Metric = {
  category: 'Error',
  action: 'Api',
  typeIn: (type) => !isServerCrash(type),
  title: 'Failed Requests',
  blurb:
    'Requests a caller saw fail: non-2xx responses and dropped requests in the editor, failed api calls inside MCP tools, and failed email sends. A server crash appears here as the Http500 its caller saw.',
};
export const SERVER_CRASHES: Metric = {
  category: 'Error',
  action: 'Api',
  typeIn: isServerCrash,
  title: 'Server Crashes',
  blurb:
    'Unhandled exceptions the api worker reported about itself, by route. Most also appear as an Http500 in Failed Requests, so read the two side by side rather than adding them.',
};
export const CLIENT_EXCEPTIONS: Metric = {
  category: 'Error',
  action: 'Client',
  typeIn: (type) => !isRecovery(type),
  title: 'Client Exceptions',
  blurb:
    'Uncaught exceptions, unhandled promise rejections, and editor areas that failed to render, in the editor and help centre.',
};
export const REALTIME_RESYNCS: Metric = {
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
  stack: true,
  title: 'Exceptions',
  blurb:
    'Errors people hit, from failed requests and client exceptions, beside the server crashes behind them and the realtime resyncs that recovered. Zero is the goal.',
  members: [FAILED_REQUESTS, SERVER_CRASHES, CLIENT_EXCEPTIONS, REALTIME_RESYNCS],
  headline: [FAILED_REQUESTS, CLIENT_EXCEPTIONS],
  seeAlso: { view: 'exceptions', label: 'See Each Error on the Exceptions Tab' },
};
