// Emails sent by the api worker, one chart per template (docs/specs/017-telemetry/telemetry.md, docs/specs/014-identity/transactional-email.md).
// Part of the metric catalogue: import from ../metric-catalogue.

import type { Metric, MetricStack, Rising } from '../metric-series';

// Emails sent, one per template (docs/specs/014-identity/transactional-email.md), by the `kind` the api worker
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
  'A teammate was emailed about work assigned to them.',
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
