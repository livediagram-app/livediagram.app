import { pageViewApp, type PageViewApp } from '@livediagram/api-schema';
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

// Diagram lifecycle (Content tab).
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

// Tab lifecycle (Content tab).
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
// Search and Raw still show the underlying events.

export const ELEMENTS_ADDED: Metric = {
  category: 'Element',
  action: 'Added',
  allTypes: true,
  title: 'Elements Added',
  blurb:
    'Every shape, text, sticky, arrow, or image put on a canvas, across all kinds. Copies count too: a duplicate or paste adds one per element it creates.',
};

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
