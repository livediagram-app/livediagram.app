// Working together: live sessions, sharing, discussion, the Timeline, teams and the session tools (docs/specs/017-telemetry/telemetry.md).
// Part of the metric catalogue: import from ../metric-catalogue.

import type { Metric, MetricStack } from '../metric-series';
import { SESSION_TIMER_OPENED, SESSION_VOTE_OPENED } from './features';
import { chart } from './helpers';

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

export const TEAM_DOCUMENTS_MOVED = chart(
  'Team',
  'Moved',
  'Team Documents Moved',
  'A document moved within a team library.',
);

export const SHARE_LINKS_COPIED = chart(
  'UI',
  'Copied',
  'Share Links Copied',
  'A document share link, embed code or live image copied. (Team invite links are in Team Activity.)',
  {
    typeIn: (t) => t !== 'TeamInviteLink' && t !== 'Diagnostics' && t !== 'Diagnostics.Help',
  },
);

export const SHARE_SETTINGS = chart(
  'Document',
  'Shared',
  'Share Link Settings',
  'A password or an expiry set on a share link.',
  { typeIn: (t) => t !== 'Edit' && t !== 'View' && t !== 'Participate' },
);

export const SHARE_LINKS_REMOVED = chart(
  'Document',
  'Removed',
  'Share Links Removed',
  'A share link switched off.',
  { rising: 'neutral' },
);

export const FEED_RETRIES = chart(
  'Activity',
  'Loaded',
  'Inbox Retries',
  "The Explorer's Inbox retried after failing to load.",
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

export const EMBEDS_VIEWED = chart(
  'Session',
  'Opened',
  'Embeds Viewed',
  'A document opened inside another site through its embed.',
  { types: ['Embed'] },
);

export const WORKBENCH_SESSIONS = chart(
  'Session',
  'Opened',
  'Workbench Sessions',
  'A document opened inside a developer tool’s frame, signed in.',
  { types: ['Workbench'] },
);

// The workspace scope (docs/specs/013-workspace/workbench-embeds.md "Two scopes"): the Explorer in a tool's frame.
export const WORKBENCH_WORKSPACES = chart(
  'Session',
  'Opened',
  'Workbench Workspaces',
  'The Explorer opened inside a developer tool’s frame, signed in.',
  { types: ['WorkbenchWorkspace'] },
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
  'A member removed, an invite withdrawn, a document or an invite link taken out of a team, or someone leaving.',
  { rising: 'neutral' },
);

export const INVITE_LINKS_SHARED = chart(
  'Team',
  'Shared',
  'Invite Links Shared',
  'A team invite link made to share.',
);

export const LIVE_IMAGE_TABS = chart(
  'UI',
  'Selected',
  'Live Image Tabs Picked',
  'A tab chosen for a live image link.',
  { types: ['LiveImageTab'] },
);

// ---- Collaboration tab -------------------------------------------------------
// Everything but Live Together counts an INVITATION (a link made, a member
// added, a vote opened); Live Together counts two people on one canvas at the
// same moment, which is what the rest is FOR, so read the rest against it. The
// session tools (docs/specs/012-collaboration/session-tools.md) are read by their drop-off: votes
// started vs revealed, dots cast vs retracted, timers started vs finished.

export const MULTIPLAYER_SESSIONS: Metric = {
  category: 'Document',
  action: 'Used',
  type: 'Multiplayer',
  title: 'Multiplayer Sessions',
  blurb:
    'A document was open with at least one other person live in the room. Counted once per document per visit, however many people turn up.',
};

export const EDIT_LINKS_SHARED: Metric = {
  category: 'Document',
  action: 'Shared',
  type: 'Edit',
  title: 'Edit Links Shared',
};

export const VIEW_LINKS_SHARED: Metric = {
  category: 'Document',
  action: 'Shared',
  type: 'View',
  title: 'View Links Shared',
};

// Participant links (docs/specs/013-workspace/share-roles.md): take part and write, never reshape the board.
export const PARTICIPATE_LINKS_SHARED: Metric = {
  category: 'Document',
  action: 'Shared',
  type: 'Participate',
  title: 'Participant Links Shared',
};

export const PARTICIPANTS_JOINED: Metric = {
  category: 'Document',
  action: 'Joined',
  type: 'Participate',
  title: 'Participants Joined',
  blurb:
    'People who came into a document through a Participant link. Counted once per person per document, not on every revisit.',
};

export const COLLABORATORS_JOINED: Metric = {
  category: 'Document',
  action: 'Joined',
  type: 'Edit',
  title: 'Collaborators Joined',
  blurb:
    'People who came into a document through an edit link. Counted once per person per document, not on every revisit.',
};

export const VIEWERS_JOINED: Metric = {
  category: 'Document',
  action: 'Joined',
  type: 'View',
  title: 'Viewers Joined',
  blurb:
    'People who came into a document through a view-only link. Counted once per person per document, not on every revisit.',
};

export const COMMENTS_ADDED: Metric = {
  category: 'Comment',
  action: 'Added',
  // Canvas comments send no type; a Plan card's comments send Item. Both count.
  allTypes: true,
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
  // On the canvas and on Plan cards (Item) alike.
  allTypes: true,
  title: 'Comments Resolved',
};

export const COMMENTS_MENTIONED: Metric = {
  category: 'Comment',
  action: 'Mentioned',
  type: null,
  title: 'Comments With Mentions',
  blurb: 'A comment was sent that @-mentioned at least one teammate.',
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

// docs/specs/013-workspace/teams.md "Declining from the email": the same answer, given from the inbox.
export const INVITES_DECLINED_FROM_EMAIL: Metric = {
  category: 'Team',
  action: 'Declined',
  type: 'Email',
  rising: 'neutral',
  title: 'Invites Declined From Email',
  blurb:
    "The recipient turned an invitation down from the email's Decline link, without signing in.",
};

export const DOCUMENTS_SHARED_TO_A_TEAM: Metric = {
  category: 'Team',
  action: 'Added',
  type: 'Document',
  title: 'Documents Shared to a Team',
  blurb: "A document was moved into a team's shared library for everyone on the team.",
};

export const VOTES_STARTED: Metric = {
  category: 'Tab',
  action: 'Started',
  type: 'Vote',
  title: 'Votes Started',
  blurb: 'Someone opened a dot-vote on a tab.',
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
  blurb: 'The host showed the tallies. A vote started but never revealed is one that fizzled.',
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
  blurb: 'Two or more people on one canvas at the same moment.',
  members: [MULTIPLAYER_SESSIONS],
  headline: MULTIPLAYER_SESSIONS,
};

export const SHARING_AND_JOINING: MetricStack = {
  stack: true,
  title: 'Sharing & Joining',
  blurb: 'Edit, Participant and view links made, and the people who came in through them.',
  members: [
    EDIT_LINKS_SHARED,
    PARTICIPATE_LINKS_SHARED,
    VIEW_LINKS_SHARED,
    COLLABORATORS_JOINED,
    PARTICIPANTS_JOINED,
    VIEWERS_JOINED,
    SHARE_LINKS_COPIED,
    SHARE_SETTINGS,
    SHARE_LINKS_REMOVED,
    EMBEDS_VIEWED,
    WORKBENCH_SESSIONS,
    WORKBENCH_WORKSPACES,
    LIVE_IMAGE_TABS,
  ],
  headline: [COLLABORATORS_JOINED, PARTICIPANTS_JOINED, VIEWERS_JOINED],
};

export const DISCUSSION: MetricStack = {
  stack: true,
  title: 'Discussion',
  blurb: 'Comments left on elements, opened to read or reply, and resolved.',
  members: [
    COMMENTS_ADDED,
    COMMENT_POPOVERS_OPENED,
    COMMENTS_RESOLVED,
    COMMENTS_MENTIONED,
    COMMENTS_REOPENED,
    COMMENTS_DELETED,
  ],
  headline: COMMENTS_ADDED,
};

export const INVITE_LINKS_COPIED = chart(
  'UI',
  'Copied',
  'Invite Links Copied',
  'A team invite link copied to share.',
  { types: ['TeamInviteLink'] },
);
export const TEAM_ACTIVITY: MetricStack = {
  stack: true,
  title: 'Team Activity',
  blurb:
    'Teams made, the invite funnel (sent, accepted, declined), and documents shared to a team.',
  members: [
    TEAMS_CREATED,
    INVITES_SENT,
    INVITES_ACCEPTED,
    INVITES_DECLINED,
    INVITES_DECLINED_FROM_EMAIL,
    DOCUMENTS_SHARED_TO_A_TEAM,
    TEAM_DOCUMENTS_MOVED,
    INVITE_LINKS_SHARED,
    TEAM_CHANGES,
    TEAM_REMOVALS,
    TEAMS_DELETED,
    INVITE_LINKS_COPIED,
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
    SESSION_VOTE_OPENED,
  ],
  headline: VOTES_STARTED,
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
    SESSION_TIMER_OPENED,
  ],
  headline: COUNTDOWNS_STARTED,
};

export const STOPWATCHES: MetricStack = {
  stack: true,
  title: 'Stopwatches',
  blurb: 'Count-up timers set running on a tab, and finished.',
  members: [
    STOPWATCHES_STARTED,
    STOPWATCHES_FINISHED,
    TIMERS_PAUSED,
    TIMERS_RESET,
    TIMERS_RESUMED,
    SESSION_TIMER_OPENED,
  ],
  headline: STOPWATCHES_STARTED,
};

// The Explorer Timeline (docs/specs/013-workspace/timeline.md) and the Explorer's Inbox (docs/specs/013-workspace/inbox.md).
// Timeline·Opened carries four things by type: two ways of arriving on the
// feed (Landing, the Explorer's default page, and Nav, a deliberate visit),
// which is how the landing-page change is measured, and two things done in it
// (a card or stack menu opened, a stacked run expanded).
export const TIMELINE_LANDINGS = chart(
  'Timeline',
  'Opened',
  'Timeline Landings',
  'A page load that started on the Timeline.',
  { types: ['Landing'] },
);

export const TIMELINE_VISITS = chart(
  'Timeline',
  'Opened',
  'Timeline Visits',
  "The Timeline opened after starting elsewhere: its sidebar row, or Home's See Timeline.",
  { types: ['Nav'] },
);

export const TIMELINE_MENUS = chart(
  'Timeline',
  'Opened',
  'Timeline Card Menus',
  'The menu on a Timeline card or stack opened, by its button or a right-click.',
  { types: ['Menu'] },
);

export const TIMELINE_STACKS_EXPANDED = chart(
  'Timeline',
  'Opened',
  'Stacks Expanded',
  'A stacked run of changes on the Timeline opened up to show each one.',
  { types: ['Stack'] },
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
  'Inbox Opened',
  "The Explorer's Inbox opened, once per visit.",
);

export const ACTIVITY_THREADS = chart(
  'Activity',
  'Selected',
  'Inbox Items Opened',
  "An action, a Plan card or a comment thread opened from the Explorer's Inbox.",
);

// Explorer Home (docs/specs/013-workspace/explorer-home.md): arrivals by type, documents opened
// from each part of Home, summaries expanded, and failed reads retried.
export const HOME_LANDINGS = chart(
  'Home',
  'Opened',
  'Home Landings',
  'The Explorer opened straight onto Home, its default page.',
  { types: ['Landing'] },
);

export const HOME_VISITS = chart(
  'Home',
  'Opened',
  'Home Visits',
  'Home opened after starting elsewhere in the Explorer.',
  { types: ['Nav'] },
);

export const HOME_WELCOMES = chart(
  'Home',
  'Opened',
  'First-Run Homes',
  'Home shown to someone with no documents yet, offering blanks and popular templates to start from.',
  { types: ['Welcome'] },
);

export const HOME_DOCUMENTS_OPENED = chart(
  'Home',
  'Selected',
  'Documents Opened from Home',
  'A document opened from Jump Back In (most used or recent) or What Happened, See More followed, or a start taken from the first-run Home.',
);

export const HOME_GROUPS_EXPANDED = chart(
  'Home',
  'Opened',
  'Home Summaries Expanded',
  "A summary of several people's work on one document opened up to every action.",
  { types: ['Group'] },
);

export const HOME_LOADS = chart('Home', 'Loaded', 'Home Retries', 'A failed read of Home retried.');

export const TIMELINE_AND_ACTIVITY: MetricStack = {
  stack: true,
  title: 'Timeline & Activity',
  blurb:
    "Keeping up with what changed: Explorer Home, the Explorer Timeline and the Explorer's Inbox.",
  members: [
    HOME_LANDINGS,
    HOME_VISITS,
    HOME_WELCOMES,
    HOME_DOCUMENTS_OPENED,
    HOME_GROUPS_EXPANDED,
    HOME_LOADS,
    TIMELINE_LANDINGS,
    TIMELINE_VISITS,
    TIMELINE_MENUS,
    TIMELINE_STACKS_EXPANDED,
    TIMELINE_ENTRIES_REMOVED,
    ACTIVITY_OPENED,
    ACTIVITY_THREADS,
    TIMELINE_LOADS,
    TIMELINE_VIEW_SWITCHED,
    TIMELINE_FILTERED,
    FEED_RETRIES,
  ],
};
