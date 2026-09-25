import { PALETTE_TELEMETRY_TYPES, pageViewApp, type PageViewApp } from '@livediagram/api-schema';
import { isRecovery, isServerCrash } from './error-kinds';
import { canonicalElementType, PALETTE_KINDS, type PaletteTab } from './palette-types';
import type { Metric, MetricStack, Rising } from './metric-series';

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

// Parked: cleared from the Dashboard (September 2026) while it is rebuilt, and on
// no other tab as a card, so kept here with their wording ready to add back.
// Search still shows the underlying events. (Elements Added came back
// as a stack; Dark-Mode Switches became the Settings tab's Theme chart.)

export const EXPORTS: Metric = {
  category: 'Diagram',
  action: 'Exported',
  allTypes: true,
  title: 'Exports',
  blurb:
    'A tab or selection exported, across every format (PNG, SVG, PDF, JSON, Mermaid, Markdown, Excalidraw). For the text formats, copying to the clipboard counts as an export too.',
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
  members: [LAYERS_CREATED, LAYER_TOGGLES, LAYER_MOVES, LAYERS_DELETED, LAYERS_PANEL_OPENED],
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
  members: [MULTIPLAYER_SESSIONS, VIEWPORTS_FOLLOWED],
  headline: MULTIPLAYER_SESSIONS,
};
export const SHARING_AND_JOINING: MetricStack = {
  stack: true,
  title: 'Sharing & Joining',
  blurb: 'Edit and view links made, and the people who came in through them.',
  members: [EDIT_LINKS_SHARED, VIEW_LINKS_SHARED, COLLABORATORS_JOINED, VIEWERS_JOINED],
};
export const DISCUSSION: MetricStack = {
  stack: true,
  title: 'Discussion',
  blurb: 'Comments left on elements, opened to read or reply, and resolved.',
  members: [COMMENTS_ADDED, COMMENT_POPOVERS_OPENED, COMMENTS_RESOLVED],
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
  ],
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
  members: [COUNTDOWNS_STARTED, TIMERS_EXTENDED, COUNTDOWNS_FINISHED, TIMERS_PAUSED, TIMERS_RESET],
  headline: COUNTDOWNS_STARTED,
};
export const STOPWATCHES: MetricStack = {
  stack: true,
  title: 'Stopwatches',
  blurb: 'Count-up timers set running on a tab, and finished.',
  members: [STOPWATCHES_STARTED, STOPWATCHES_FINISHED, TIMERS_PAUSED, TIMERS_RESET],
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
  members: [NOTES_ADDED, NOTES_OPENED],
  headline: NOTES_ADDED,
};
export const ASSIGNED_ACTIONS: MetricStack = {
  stack: true,
  title: 'Assigned Actions',
  blurb: 'Element-level work assigned to a teammate (spec/68), emailed about, and completed.',
  members: [ACTIONS_ASSIGNED, ACTIONS_EMAILED, ACTIONS_COMPLETED],
  headline: ACTIONS_ASSIGNED,
};
export const ORGANISATION: MetricStack = {
  stack: true,
  title: 'Organisation',
  blurb: 'Folders made and nested, tab folders, and tabs and diagrams filed.',
  members: [FOLDERS_CREATED, FOLDERS_RE_PARENTED, TAB_FOLDERS_CREATED, TABS_FILED, DIAGRAMS_FILED],
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
      'The AI assistant opt-in, both ways. AI Turned On on Editing counts only the on.',
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
  PANELS_SETTINGS,
  NOTIFICATION_SETTINGS,
  ACCESSIBILITY_SETTINGS,
  AI_SETTINGS,
  PRIVACY_SETTINGS,
];
