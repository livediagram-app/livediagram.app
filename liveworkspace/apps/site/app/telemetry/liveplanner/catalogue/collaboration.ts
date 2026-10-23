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

export const TIMELINE: MetricStack = {
  stack: true,
  title: 'Timeline',
  blurb:
    'What happened to people’s plans, read in the Explorer: cards opened, runs expanded, menus, removals, filters and pages.',
  members: [
    TIMELINE_CARDS_OPENED,
    TIMELINE_STACKS_EXPANDED,
    TIMELINE_MENUS_OPENED,
    TIMELINE_REMOVED,
    TIMELINE_LOADS,
    TIMELINE_VIEW_SWITCHED,
    TIMELINE_FILTERED,
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
