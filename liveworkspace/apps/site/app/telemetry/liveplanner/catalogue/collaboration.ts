// Working together: live sessions, embeds, discussion, the Timeline, teams and the session tools (docs/specs/017-telemetry/telemetry.md).
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

export const PARTICIPANTS_JOINED: Metric = {
  category: 'Project',
  action: 'Joined',
  type: 'Participate',
  title: 'Participants Joined',
  blurb:
    'People who came into a project through a Participant link. Counted once per person per project, not on every revisit.',
};

export const COLLABORATORS_JOINED: Metric = {
  category: 'Project',
  action: 'Joined',
  type: 'Edit',
  title: 'Collaborators Joined',
  blurb:
    'People who came into a project through an edit link. Counted once per person per project, not on every revisit.',
};

export const VIEWERS_JOINED: Metric = {
  category: 'Project',
  action: 'Joined',
  type: 'View',
  title: 'Viewers Joined',
  blurb:
    'People who came into a project through a view-only link. Counted once per person per project, not on every revisit.',
};

export const EMBEDS_VIEWED = chart(
  'Session',
  'Opened',
  'Embeds Viewed',
  'A project opened inside another site through its embed.',
  { types: ['Embed'] },
);

export const WORKBENCH_SESSIONS = chart(
  'Session',
  'Opened',
  'Workbench Sessions',
  'A project opened inside a developer tool’s frame, signed in.',
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

// ---- Collaboration tab -------------------------------------------------------
// Everything but Live Together counts a way in (an embed, a workbench frame, a
// project made in a team) or a session tool; Live Together counts two people on one canvas at the
// same moment, which is what the rest is FOR, so read the rest against it. The
// session tools (docs/specs/012-collaboration/session-tools.md) are read by their drop-off: votes
// started vs revealed, dots cast vs retracted, timers started vs finished.

export const MULTIPLAYER_SESSIONS: Metric = {
  category: 'Project',
  action: 'Used',
  type: 'Multiplayer',
  title: 'Multiplayer Sessions',
  blurb:
    'A project was open with at least one other person live in the room. Counted once per project per visit, however many people turn up.',
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

export const PROJECTS_SHARED_TO_A_TEAM: Metric = {
  category: 'Team',
  action: 'Added',
  type: 'Project',
  title: 'Projects Shared to a Team',
  blurb: "A project was created straight into a team's shared library, for everyone on the team.",
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

// The shared Explorer's Timeline (docs/specs/013-workspace/timeline.md), reported through its onTimeline prop.
export const TIMELINE_CARDS_OPENED = chart(
  'Timeline',
  'Opened',
  'Timeline Cards Opened',
  'A plan opened from its card on the Timeline.',
  { types: ['Card'] },
);

export const TIMELINE_STACKS_EXPANDED = chart(
  'Timeline',
  'Opened',
  'Timeline Stacks Expanded',
  'A run of one kind of change on the Timeline dealt out to show each one.',
  { types: ['Stack'] },
);

export const TIMELINE_MENUS_OPENED = chart(
  'Timeline',
  'Opened',
  'Timeline Menus Opened',
  'A card’s or a run’s ⋯ menu opened on the Timeline.',
  { types: ['Menu'] },
);

export const TIMELINE_REMOVED = chart(
  'Timeline',
  'Removed',
  'Removed from Timeline',
  'An entry (Entry) or a whole run (Stack) taken off someone’s own Timeline.',
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
  'The Timeline switched between its cards and its calendar.',
);

export const TIMELINE_FILTERED = chart(
  'Timeline',
  'Selected',
  'Timeline Filtered',
  'The Timeline narrowed to everyone, other people, or switched off a kind of event.',
);

// Explorer Home's What Happened (docs/specs/013-workspace/explorer-home.md), reported through its onHome prop.
export const WHAT_HAPPENED_OPENED = chart(
  'Home',
  'Selected',
  'What Happened Entries Opened',
  'A plan opened from Home’s What Happened, or See Timeline followed from it.',
);

export const WHAT_HAPPENED_GROUPS = chart(
  'Home',
  'Opened',
  'What Happened Summaries Opened',
  'A summary of several people’s doings on one plan dealt out on Home.',
);

// The Explorer's filter lens (docs/specs/013-workspace/explorer-filters.md "Telemetry"): Explorer·Selected·<Facet>,
// one per facet that gained a value, by kind (never what was picked).
export const EXPLORER_FILTERS_PICKED = chart(
  'Explorer',
  'Selected',
  'Explorer Filters Used',
  'A filter reached for on an Explorer list, by kind: words, Opens in, Template, Made by AI, Edited, People or Space, from a chip, a suggestion or a typed token.',
  { rising: 'good' },
);

// The Share dialog's passes (@liveworkspace/explorer ShareDialog), reported through its onTelemetry prop.
export const SHARE_LINKS_COPIED = chart(
  'UI',
  'Copied',
  'Share Links Copied',
  'A pass’s link copied, by hand or as the pass was made.',
  { types: ['ShareLink'] },
);

export const SHARE_EMBEDS_COPIED = chart(
  'UI',
  'Copied',
  'Embeds Copied',
  'A pass’s embed copied, as its address or an iframe.',
  { types: ['EmbedCode'] },
);

export const SHARE_LIVE_IMAGES_COPIED = chart(
  'UI',
  'Copied',
  'Live Images Copied',
  'A pass’s live image copied, as its address, Markdown or HTML.',
  { types: ['LiveImage'] },
);

export const SHARE_LIVE_IMAGE_TABS = chart(
  'UI',
  'Selected',
  'Live Image Tabs Picked',
  'Another tab picked for a live image to draw.',
  { types: ['LiveImageTab'] },
);

export const SHARE_LINKS_REVOKED = chart(
  'Project',
  'Removed',
  'Share Links Revoked',
  'A pass revoked from the Share dialog, after its confirmation.',
  { types: ['ShareLink'], rising: 'neutral' },
);

export const SHARE_TOURS_STARTED = chart(
  'UI',
  'Started',
  'Share Tours Started',
  'The Share dialog’s Show Me tour started.',
  { types: ['ShareTour'] },
);

export const SHARE_TOURS_COMPLETED = chart(
  'UI',
  'Ended',
  'Share Tours Completed',
  'The Share dialog’s Show Me tour run to its last step.',
  { types: ['ShareTourCompleted'] },
);

export const SHARE_TOURS_SKIPPED = chart(
  'UI',
  'Ended',
  'Share Tours Skipped',
  'The Share dialog’s Show Me tour closed before its end.',
  { types: ['ShareTourSkipped'], rising: 'neutral' },
);

export const SHARE_PASSES: MetricStack = {
  stack: true,
  title: 'Share Passes',
  blurb:
    'Links handed over from the Share dialog: copied, as embeds or live images, revoked, and its Show Me tour.',
  members: [
    SHARE_LINKS_COPIED,
    SHARE_EMBEDS_COPIED,
    SHARE_LIVE_IMAGES_COPIED,
    SHARE_LIVE_IMAGE_TABS,
    SHARE_LINKS_REVOKED,
    SHARE_TOURS_STARTED,
    SHARE_TOURS_COMPLETED,
    SHARE_TOURS_SKIPPED,
  ],
  headline: SHARE_LINKS_COPIED,
};

// The Explorer's Inbox (one-explorer-contracts.md "Inbox"): visits, the rows people follow, and failed reads retried.
export const INBOX_OPENED = chart(
  'Activity',
  'Opened',
  'Inbox Opened',
  "The Explorer's Inbox opened, once per visit.",
);

export const INBOX_ROWS_OPENED = chart(
  'Activity',
  'Selected',
  'Inbox Items Opened',
  "An action, a Plan card, a comment thread or a form's new responses opened from the Explorer's Inbox.",
);

export const INBOX_RETRIES = chart(
  'Activity',
  'Loaded',
  'Inbox Retries',
  "A failed read of the Explorer's Inbox tried again.",
  { types: ['Retry'], rising: 'bad' },
);

export const INBOX: MetricStack = {
  stack: true,
  title: 'Inbox',
  blurb:
    "What waits on people, read in the Explorer's Inbox: visits, the rows they follow, and failed reads retried.",
  members: [INBOX_OPENED, INBOX_ROWS_OPENED, INBOX_RETRIES],
  headline: INBOX_ROWS_OPENED,
};

export const TIMELINE: MetricStack = {
  stack: true,
  title: 'Timeline',
  blurb:
    'What happened to people’s plans, read in the Explorer’s Timeline and Home’s What Happened: cards opened, runs expanded, menus, removals, filters and pages.',
  members: [
    TIMELINE_CARDS_OPENED,
    TIMELINE_STACKS_EXPANDED,
    TIMELINE_MENUS_OPENED,
    TIMELINE_REMOVED,
    TIMELINE_LOADS,
    TIMELINE_VIEW_SWITCHED,
    TIMELINE_FILTERED,
    WHAT_HAPPENED_OPENED,
    WHAT_HAPPENED_GROUPS,
  ],
  headline: TIMELINE_CARDS_OPENED,
};

export const LIVE_TOGETHER: MetricStack = {
  stack: true,
  title: 'Live Together',
  blurb: 'Two or more people on one canvas at the same moment.',
  members: [MULTIPLAYER_SESSIONS],
  headline: MULTIPLAYER_SESSIONS,
};

export const JOINING: MetricStack = {
  stack: true,
  title: 'Joining',
  blurb:
    'The people who came into a project through an edit, Participant or view link, the first time each.',
  members: [COLLABORATORS_JOINED, PARTICIPANTS_JOINED, VIEWERS_JOINED],
  headline: [COLLABORATORS_JOINED, PARTICIPANTS_JOINED, VIEWERS_JOINED],
};

export const EMBEDS_AND_WORKBENCH: MetricStack = {
  stack: true,
  title: 'Embeds & Workbench',
  blurb:
    'Projects opened inside another site through an embed, or inside a developer tool’s frame.',
  members: [EMBEDS_VIEWED, WORKBENCH_SESSIONS, WORKBENCH_WORKSPACES],
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

export const TEAM_ACTIVITY: MetricStack = {
  stack: true,
  title: 'Team Activity',
  blurb: 'Projects created straight into a team’s shared library.',
  members: [PROJECTS_SHARED_TO_A_TEAM],
  headline: PROJECTS_SHARED_TO_A_TEAM,
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
