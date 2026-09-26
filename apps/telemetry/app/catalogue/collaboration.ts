// Working together: live sessions, sharing, discussion, the Timeline, teams and the facilitation tools (spec/22).
// Part of the metric catalogue: import from ../metric-catalogue.

import type { Metric, MetricStack } from '../metric-series';
import { SLIDE_DECK_OPENED } from './features';
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

export const TEAM_DIAGRAMS_MOVED = chart(
  'Team',
  'Moved',
  'Team Diagrams Moved',
  'A diagram moved within a team library.',
);

export const SHARE_LINKS_COPIED = chart(
  'UI',
  'Copied',
  'Share Links Copied',
  'A diagram share link, embed code or live image copied. (Team invite links are in Team Activity.)',
  { typeIn: (t) => t !== 'TeamInviteLink' },
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
  'Someone asked to take the facilitator role. Counted on the ask, so a refused claim counts too.',
);

export const FACILITATOR_RELEASED = chart(
  'Facilitator',
  'Ended',
  'Facilitator Released',
  'The facilitator handed the role back.',
);

export const AVATARS_CUSTOMISED = chart(
  'UI',
  'Changed',
  'Avatars Customised',
  'Someone changed their avatar: randomised, clothing, or figure.',
  { typeIn: (t) => (t ?? '').startsWith('Avatar') },
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

export const FACILITATOR_CONTROLS = chart(
  'Facilitator',
  'Changed',
  'Facilitator Controls',
  'The facilitator handed the role to someone, or released a participant\u2019s lock on an element. Counted on the ask.',
);

export const EMBEDS_VIEWED = chart(
  'Session',
  'Opened',
  'Embeds Viewed',
  'A diagram opened inside another site through its embed.',
  { types: ['Embed'] },
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
  'A member removed, an invite withdrawn, a diagram or an invite link taken out of a team, or someone leaving.',
  { rising: 'neutral' },
);

export const INVITE_LINKS_SHARED = chart(
  'Team',
  'Shared',
  'Invite Links Shared',
  'A team invite link made to share.',
);

export const SLIDE_NOTES = chart(
  'UI',
  'Changed',
  'Slide Notes',
  'Speaker notes on a slide edited.',
  { types: ['SlideNotes'] },
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
    "Someone pinned their view to a teammate's, following their pan, zoom and tab: the strongest signal that a session is being presented rather than just co-edited.",
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
  blurb: 'A live pulse-check was opened on a tab. Nothing about a poll is persisted.',
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

// The Explorer Timeline (spec/138) and the editor's Activity panel.
// Timeline·Opened carries four things by type: two ways of arriving on the
// feed (Landing, the Explorer's default page, and Nav, a deliberate visit),
// which is how the landing-page change is measured, and two things done in it
// (a card or stack menu opened, a stacked run expanded).
export const TIMELINE_LANDINGS = chart(
  'Timeline',
  'Opened',
  'Timeline Landings',
  'The Explorer opened straight onto the Timeline, its default page.',
  { types: ['Landing'] },
);

export const TIMELINE_VISITS = chart(
  'Timeline',
  'Opened',
  'Timeline Visits',
  'The Timeline opened on purpose, from the Explorer nav after starting elsewhere.',
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
  'Activity Opened',
  'The editor Activity panel shown, each time it mounts. Expanding it from minimised also counts in Dialogs & Panels.',
);

export const ACTIVITY_THREADS = chart(
  'Activity',
  'Selected',
  'Activity Items Opened',
  'An action or a comment thread opened from the Activity panel.',
);

export const TIMELINE_AND_ACTIVITY: MetricStack = {
  stack: true,
  title: 'Timeline & Activity',
  blurb: 'Keeping up with what changed: the Explorer Timeline and the editor Activity panel.',
  members: [
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

// Presentations (spec/31).
export const SLIDES_REORDERED = chart(
  'UI',
  'Moved',
  'Slides Reordered',
  'Slides dragged into a new order in the deck.',
  { types: ['Slide'] },
);
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

// The presenter settings (transition, speed, auto-advance, loop and the
// rest) send UI·Changed·Presentation-<field>: which setting, never its value.
export const PRESENTER_SETTINGS_CHANGED = chart(
  'UI',
  'Changed',
  'Presenter Settings Changed',
  'A presentation setting changed: the transition, speed, auto-advance, loop, zoom, or what the presenter sees.',
  { typeIn: (type) => (type ?? '').startsWith('Presentation-') },
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
    SLIDES_REORDERED,
    PRESENTER_SETTINGS_CHANGED,
  ],
  headline: PRESENTATIONS_STARTED,
};
