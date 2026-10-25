// Working together: live sessions, the Share dialog and embeds, discussion, the Timeline, teams and presenting (docs/specs/017-telemetry/telemetry.md).
// Part of the metric catalogue: import from ../metric-catalogue.

import type { Metric, MetricStack } from '../../_shared/metric-series';
import { SLIDE_DECK_OPENED } from './features';
import { chart } from '../../_shared/catalogue-helpers';

// The shared Share dialog (@liveworkspace/explorer ShareDialog), reported through its host's onTelemetry
// (apps/editor lib/explorer-share-host.ts) and, from the Explorer on liveworkspace.app, in this app's name.
export const SHARE_LINKS_COPIED = chart(
  'UI',
  'Copied',
  'Share Links Copied',
  'A document share link, embed code or live image copied.',
  {
    typeIn: (t) => t !== 'TeamInviteLink' && t !== 'Diagnostics' && t !== 'Diagnostics.Help',
  },
);

export const SHARE_LINKS_REMOVED = chart(
  'Document',
  'Removed',
  'Share Links Removed',
  'A share link revoked from the Share dialog.',
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

// Freeing an element a peer is holding (docs/specs/007-editor/editor-app.md concurrent-selection lock).
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

export const TEAM_REMOVALS = chart(
  'Team',
  'Removed',
  'Team Removals',
  'A member removed, an invite withdrawn, a document or an invite link taken out of a team, or someone leaving.',
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
// Everything but Live Together counts a way in (a link copied, an embed, a
// workbench frame); Live Together counts two people on one canvas at the same
// moment, which is what the rest is FOR, so read the rest against it.

export const MULTIPLAYER_SESSIONS: Metric = {
  category: 'Document',
  action: 'Used',
  type: 'Multiplayer',
  title: 'Multiplayer Sessions',
  blurb:
    'A document was open with at least one other person live in the room. Counted once per document per visit, however many people turn up.',
};

export const VIEWPORTS_FOLLOWED: Metric = {
  category: 'Canvas',
  action: 'Used',
  type: 'FollowMe',
  title: 'Viewports Followed',
  blurb:
    "Someone pinned their view to a teammate's, following their pan, zoom and tab: the strongest signal that a session is being presented rather than just co-edited.",
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
  blurb: 'A new team workspace was created, in the app or on liveworkspace.app.',
};

// Teams are run on liveworkspace.app, where accounts counts each change under the app the person acting signed up
// through (liveworkspace/docs/accounts.md "Teams").
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

// The same answer, given from the invitation email's Decline link.
export const INVITES_DECLINED_FROM_EMAIL: Metric = {
  category: 'Team',
  action: 'Declined',
  type: 'Email',
  rising: 'neutral',
  title: 'Invites Declined From Email',
  blurb:
    "The recipient turned an invitation down from the email's Decline link, without signing in.",
};

export const INVITE_LINKS_SHARED = chart(
  'Team',
  'Shared',
  'Invite Links Shared',
  'A team invite link turned on to share.',
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

export const TEAM_DOCUMENTS_MOVED = chart(
  'Team',
  'Moved',
  'Team Documents Moved',
  'A document already in a team moved on: to another team, or within the Explorer.',
);

export const DOCUMENTS_SHARED_TO_A_TEAM: Metric = {
  category: 'Team',
  action: 'Added',
  type: 'Document',
  title: 'Documents Shared to a Team',
  blurb: "A document was created straight into a team's shared library, for everyone on the team.",
};

export const LIVE_TOGETHER: MetricStack = {
  stack: true,
  title: 'Live Together',
  blurb: 'Two or more people on one canvas at the same moment, and sessions being presented.',
  members: [MULTIPLAYER_SESSIONS, VIEWPORTS_FOLLOWED, LOCKS_RELEASED],
  headline: MULTIPLAYER_SESSIONS,
};

export const COLLABORATORS_JOINED: Metric = {
  category: 'Document',
  action: 'Joined',
  type: 'Edit',
  title: 'Collaborators Joined',
  blurb:
    'People who came into a document through an edit link. Counted once per person per document, not on every revisit.',
};

export const PARTICIPANTS_JOINED: Metric = {
  category: 'Document',
  action: 'Joined',
  type: 'Participate',
  title: 'Participants Joined',
  blurb:
    'People who came into a document through a Participant link. Counted once per person per document, not on every revisit.',
};

export const VIEWERS_JOINED: Metric = {
  category: 'Document',
  action: 'Joined',
  type: 'View',
  title: 'Viewers Joined',
  blurb:
    'People who came into a document through a view-only link. Counted once per person per document, not on every revisit.',
};

export const JOINING: MetricStack = {
  stack: true,
  title: 'Joining',
  blurb:
    'The people who came into a document through an edit, Participant or view link, the first time each.',
  members: [COLLABORATORS_JOINED, PARTICIPANTS_JOINED, VIEWERS_JOINED],
  headline: [COLLABORATORS_JOINED, PARTICIPANTS_JOINED, VIEWERS_JOINED],
};

// Share links made in the Share dialog, by level, and their settings (the people who come in through them are the
// Joining stack's).
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

// Participant links: take part and write, never reshape the document.
export const PARTICIPATE_LINKS_SHARED: Metric = {
  category: 'Document',
  action: 'Shared',
  type: 'Participate',
  title: 'Participant Links Shared',
};

export const SHARE_SETTINGS = chart(
  'Document',
  'Shared',
  'Share Link Settings',
  'A share link given a lifetime or one tab when made, extended, rescoped, or given or cleared a password.',
  { typeIn: (t) => t !== 'Edit' && t !== 'View' && t !== 'Participate' },
);

export const SHARE_LINKS_MADE: MetricStack = {
  stack: true,
  title: 'Share Links Made',
  blurb: 'Edit, Participant and view links made in the Share dialog, and their settings.',
  members: [EDIT_LINKS_SHARED, PARTICIPATE_LINKS_SHARED, VIEW_LINKS_SHARED, SHARE_SETTINGS],
};

export const SHARING_AND_EMBEDS: MetricStack = {
  stack: true,
  title: 'Sharing & Embeds',
  blurb:
    'Links, embeds and live images copied from the Share dialog, links revoked, and documents opened inside another site or a developer tool’s frame.',
  members: [
    SHARE_LINKS_COPIED,
    LIVE_IMAGE_TABS,
    SHARE_LINKS_REMOVED,
    EMBEDS_VIEWED,
    WORKBENCH_SESSIONS,
    WORKBENCH_WORKSPACES,
  ],
  headline: SHARE_LINKS_COPIED,
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
  blurb:
    'Teams made, the invite funnel (sent, accepted, declined), documents shared to a team, and team upkeep.',
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
  ],
  headline: INVITES_ACCEPTED,
};

// The shared Explorer's Timeline (docs/specs/013-workspace/timeline.md) and Inbox (docs/specs/013-workspace/inbox.md),
// reported through a workbench frame's onTimeline prop and the Inbox host's onTelemetry (apps/editor
// app/embed/workbench/ExplorerHost.tsx, lib/explorer-inbox-host.tsx), and by liveworkspace's Explorer page (on
// liveworkspace.app and on this app's address) in this app's name. Timeline·Opened carries what was done in the feed by type: a card, a card or stack menu, a stacked run.

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

export const TIMELINE_CARDS_OPENED = chart(
  'Timeline',
  'Opened',
  'Timeline Cards Opened',
  'A document opened from its card on the Timeline.',
  { types: ['Card'] },
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

export const ACTIVITY_FILTERS = chart(
  'Activity',
  'Changed',
  'Inbox Filters Chosen',
  "A filter chosen over the Explorer's Inbox: All, My Actions, Assigned by Me, Comments or Form Responses.",
  { rising: 'neutral' },
);

export const ACTIVITY_REPLIES = chart(
  'Activity',
  'Added',
  'Inbox Replies',
  "A reply to a comment thread sent from the Explorer's Inbox reading pane.",
  { types: ['Reply'] },
);

export const ACTIVITY_RESOLVED = chart(
  'Activity',
  'Resolved',
  'Inbox Threads Resolved and Actions Done',
  "A thread resolved, or an action marked done in the editor's panel, from the Explorer's Inbox reading pane.",
);

// Explorer Home (docs/specs/013-workspace/explorer-home.md): What Happened, through ExplorerHost's onHome prop, and
// the first run's welcome, from the Explorer on liveworkspace.app.

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
  'A document opened from What Happened, See Timeline followed, or a start taken from the first-run Home.',
);

export const HOME_GROUPS_EXPANDED = chart(
  'Home',
  'Opened',
  'Home Summaries Expanded',
  "A summary of several people's work on one document opened up to every action.",
  { types: ['Group'] },
);

export const HOME_LOADS = chart(
  'Home',
  'Loaded',
  'Home Retries',
  'A failed read of Home retried.',
  {
    types: ['Retry'],
    rising: 'bad',
  },
);

export const TIMELINE_AND_ACTIVITY: MetricStack = {
  stack: true,
  title: 'Timeline & Activity',
  blurb:
    "Keeping up with what changed: Explorer Home, the Explorer Timeline and the Explorer's Inbox.",
  members: [
    HOME_WELCOMES,
    HOME_DOCUMENTS_OPENED,
    HOME_GROUPS_EXPANDED,
    HOME_LOADS,
    TIMELINE_MENUS,
    TIMELINE_STACKS_EXPANDED,
    TIMELINE_CARDS_OPENED,
    TIMELINE_ENTRIES_REMOVED,
    ACTIVITY_OPENED,
    ACTIVITY_THREADS,
    ACTIVITY_FILTERS,
    ACTIVITY_REPLIES,
    ACTIVITY_RESOLVED,
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
  { types: ['Slide', 'PageSlide', 'AllPageSlides'] },
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
