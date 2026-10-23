// Working together: live sessions, sharing, discussion, the Timeline, teams and presenting (docs/specs/017-telemetry/telemetry.md).
// Part of the metric catalogue: import from ../metric-catalogue.

import type { Metric, MetricStack } from '../metric-series';
import { SLIDE_DECK_OPENED } from './features';
import { chart } from './helpers';

export const TEAM_DESIGNS_MOVED = chart(
  'Team',
  'Moved',
  'Team Designs Moved',
  'A design moved within a team library.',
);

export const SHARE_LINKS_COPIED = chart(
  'UI',
  'Copied',
  'Share Links Copied',
  'A design share link, embed code or live image copied. (Team invite links are in Team Activity.)',
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

// Freeing an element a peer is holding (docs/specs/007-editor/live-app.md concurrent-selection lock).
export const LOCKS_RELEASED = chart(
  'Facilitator',
  'Changed',
  'Locks Released',
  'An element a peer was holding by selecting it freed, so someone else could work on it. Counted on the ask.',
  { types: ['Unlocked'] },
);

export const EMBEDS_VIEWED = chart(
  'Session',
  'Opened',
  'Embeds Viewed',
  'A design opened inside another site through its embed.',
  { types: ['Embed'] },
);

export const WORKBENCH_SESSIONS = chart(
  'Session',
  'Opened',
  'Workbench Sessions',
  'A design opened inside a developer tool’s frame, signed in.',
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

export const TEAM_REMOVALS = chart(
  'Team',
  'Removed',
  'Team Removals',
  'A member removed, an invite withdrawn, a design or an invite link taken out of a team, or someone leaving.',
  { rising: 'neutral' },
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
// added); Live Together counts two people on one canvas at the same moment,
// which is what the rest is FOR, so read the rest against it.

export const MULTIPLAYER_SESSIONS: Metric = {
  category: 'Document',
  action: 'Used',
  type: 'Multiplayer',
  title: 'Multiplayer Sessions',
  blurb:
    'A design was open with at least one other person live in the room. Counted once per design per visit, however many people turn up.',
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
    'People who came into a design through a Participant link. Counted once per person per design, not on every revisit.',
};

export const COLLABORATORS_JOINED: Metric = {
  category: 'Document',
  action: 'Joined',
  type: 'Edit',
  title: 'Collaborators Joined',
  blurb:
    'People who came into a design through an edit link. Counted once per person per design, not on every revisit.',
};

export const VIEWERS_JOINED: Metric = {
  category: 'Document',
  action: 'Joined',
  type: 'View',
  title: 'Viewers Joined',
  blurb:
    'People who came into a design through a view-only link. Counted once per person per design, not on every revisit.',
};

export const COMMENTS_ADDED: Metric = {
  category: 'Comment',
  action: 'Added',
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

export const DESIGNS_SHARED_TO_A_TEAM: Metric = {
  category: 'Team',
  action: 'Added',
  type: 'Design',
  title: 'Designs Shared to a Team',
  blurb: "A design was moved into a team's shared library for everyone on the team.",
};

export const LIVE_TOGETHER: MetricStack = {
  stack: true,
  title: 'Live Together',
  blurb: 'Two or more people on one canvas at the same moment, and sessions being presented.',
  members: [MULTIPLAYER_SESSIONS, VIEWPORTS_FOLLOWED, LOCKS_RELEASED],
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
    'Teams made, and designs shared to a team or moved between teams. Invitations are answered on liveworkspace.app.',
  members: [
    TEAMS_CREATED,
    DESIGNS_SHARED_TO_A_TEAM,
    TEAM_DESIGNS_MOVED,
    TEAM_REMOVALS,
    INVITE_LINKS_COPIED,
  ],
  headline: TEAMS_CREATED,
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
  "An action or a comment thread opened from the Explorer's Inbox.",
);

// Explorer Home (docs/specs/013-workspace/explorer-home.md): arrivals by type, designs opened
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
  'Home shown to someone with no designs yet, offering blanks and popular templates to start from.',
  { types: ['Welcome'] },
);

export const HOME_DESIGNS_OPENED = chart(
  'Home',
  'Selected',
  'Designs Opened from Home',
  'A design opened from Jump Back In (most used or recent) or What Happened, See More followed, or a start taken from the first-run Home.',
);

export const HOME_GROUPS_EXPANDED = chart(
  'Home',
  'Opened',
  'Home Summaries Expanded',
  "A summary of several people's work on one design opened up to every action.",
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
    HOME_DESIGNS_OPENED,
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

// Presentations (docs/specs/012-collaboration/presentation-mode.md).
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

export const SLIDES_ADDED = chart(
  'UI',
  'Added',
  'Slides Added',
  'A slide added to a deck: from a selection or a page.',
  { types: ['Slide', 'PageSlide'] },
);

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

// The Settings dialog's presenter switches send UI·Toggled·Presentation-<field>On|Off.
export const PRESENTER_SETTINGS_TOGGLED = chart(
  'UI',
  'Toggled',
  'Presenter Settings Switched',
  'A presentation switch turned on or off in Settings: advance on click, loop, or what the presenter sees.',
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
    PRESENTER_SETTINGS_TOGGLED,
  ],
  headline: PRESENTATIONS_STARTED,
};
