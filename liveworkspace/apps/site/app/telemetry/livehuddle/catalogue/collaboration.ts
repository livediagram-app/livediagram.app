// Working together: live sessions, sharing, discussion, teams and the facilitation tools (docs/specs/017-telemetry/telemetry.md).
// Part of the metric catalogue: import from ../metric-catalogue.

import type { Metric, MetricStack } from '../../_shared/metric-series';
import { chart } from '../../_shared/catalogue-helpers';

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
  'A document share link, embed code or live image copied.',
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
  'Inbox Retries',
  "The Explorer's Inbox retried after failing to load.",
  { rising: 'bad' },
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
  'A document opened inside another site through its embed.',
  { types: ['Embed'] },
);

export const TEAM_REMOVALS = chart(
  'Team',
  'Removed',
  'Team Removals',
  'A member removed, an invite withdrawn, a document or an invite link taken out of a team, or someone leaving.',
  { rising: 'neutral' },
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
// facilitation tools (docs/specs/012-collaboration/session-tools.md + docs/specs/012-collaboration/live-poll.md) are read by their drop-off: votes
// started vs revealed, dots cast vs retracted, timers started vs finished.

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

export const NUDGES_SENT: Metric = {
  category: 'Canvas',
  action: 'Used',
  type: 'Nudge',
  title: 'Nudges Sent',
  blurb:
    'Someone nudged a person in their Space from Collaborators (docs/specs/012-collaboration/nudge.md): a call for attention, at most once every 2 minutes per person.',
};

export const NUDGES_ANSWERED: Metric = {
  category: 'Canvas',
  action: 'Used',
  type: 'NudgeGoTo',
  title: 'Nudges Answered',
  blurb: 'A nudged person pressed Go To on the nudge, from its toast or desktop notification.',
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
  // Canvas comments send no type; a Plan card's comments sent Item, and still count while they age out.
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
  // On the canvas, and on Plan cards (Item) while those age out.
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
// through (liveworkspace/docs/specs/003-accounts/accounts.md "Teams").
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

export const DOCUMENTS_SHARED_TO_A_TEAM: Metric = {
  category: 'Team',
  action: 'Added',
  type: 'Document',
  title: 'Documents Shared to a Team',
  blurb: "A document was moved into a team's shared library for everyone on the team.",
};

export const LIVE_TOGETHER: MetricStack = {
  stack: true,
  title: 'Live Together',
  blurb: 'Two or more people on one canvas at the same moment, and sessions being presented.',
  members: [
    MULTIPLAYER_SESSIONS,
    VIEWPORTS_FOLLOWED,
    NUDGES_SENT,
    NUDGES_ANSWERED,
    FACILITATOR_CLAIMED,
    FACILITATOR_RELEASED,
    AVATARS_CUSTOMISED,
    FACILITATOR_CONTROLS,
  ],
  headline: MULTIPLAYER_SESSIONS,
};

export const JOINING: MetricStack = {
  stack: true,
  title: 'Joining',
  blurb:
    'The people who came into a document through an edit, Participant or view link, the first time each.',
  members: [COLLABORATORS_JOINED, PARTICIPANTS_JOINED, VIEWERS_JOINED],
  headline: [COLLABORATORS_JOINED, PARTICIPANTS_JOINED, VIEWERS_JOINED],
};

export const SHARING_AND_JOINING: MetricStack = {
  stack: true,
  title: 'Sharing & Embeds',
  blurb:
    'Edit, Participant and view links made, share links and embed codes copied or switched off, and embeds viewed.',
  members: [
    EDIT_LINKS_SHARED,
    PARTICIPATE_LINKS_SHARED,
    VIEW_LINKS_SHARED,
    SHARE_LINKS_COPIED,
    SHARE_SETTINGS,
    SHARE_LINKS_REMOVED,
    EMBEDS_VIEWED,
    LIVE_IMAGE_TABS,
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

// Explorer Home (docs/specs/013-workspace/explorer-home.md): first-run arrivals, documents opened from each part of
// Home, summaries expanded, and failed reads retried.
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
  'Starts Taken from Home',
  'A start taken from the first-run Home: a blank, a template, all templates, search or sign in.',
);

export const HOME_LOADS = chart('Home', 'Loaded', 'Home Retries', 'A failed read of Home retried.');

export const HOME_AND_ACTIVITY: MetricStack = {
  stack: true,
  title: 'Home & Activity',
  blurb: "Keeping up with what changed: Explorer Home and the Explorer's Inbox.",
  members: [
    HOME_WELCOMES,
    HOME_DOCUMENTS_OPENED,
    HOME_LOADS,
    ACTIVITY_OPENED,
    ACTIVITY_THREADS,
    ACTIVITY_FILTERS,
    ACTIVITY_REPLIES,
    ACTIVITY_RESOLVED,
    FEED_RETRIES,
  ],
};

// The Timer and Stopwatch pieces (docs/specs/009-elements/timer-and-stopwatch.md): set running, paused, reset, and a
// Timer's length set. Different tools, so different stacks; the headlines count starts.
const timerPiece = (
  type: string,
  title: string,
  blurb: string,
  action: string,
  rising?: 'neutral',
) => chart('Element', action, title, blurb, { types: [type], ...(rising ? { rising } : {}) });

export const TIMERS_STARTED = timerPiece(
  'Timer',
  'Timers Started',
  'A Timer piece in a Space set counting down.',
  'Started',
);
export const TIMERS_PAUSED = timerPiece(
  'TimerPaused',
  'Timers Paused',
  'A running Timer paused mid-count. Heavy pausing suggests the timebox rarely survives the meeting.',
  'Toggled',
  'neutral',
);
export const TIMERS_RESET = timerPiece(
  'TimerReset',
  'Timers Reset',
  'A Timer set back to its full length, usually for another round of the same exercise.',
  'Changed',
  'neutral',
);
export const TIMER_LENGTHS_SET = timerPiece(
  'TimerLength',
  'Timer Lengths Set',
  'A Timer given a new length in minutes.',
  'Changed',
);
export const STOPWATCHES_STARTED = timerPiece(
  'Stopwatch',
  'Stopwatches Started',
  'A Stopwatch piece in a Space set counting up.',
  'Started',
);
export const STOPWATCHES_PAUSED = timerPiece(
  'StopwatchPaused',
  'Stopwatches Paused',
  'A running Stopwatch paused.',
  'Toggled',
  'neutral',
);
export const STOPWATCHES_RESET = timerPiece(
  'StopwatchReset',
  'Stopwatches Reset',
  'A Stopwatch set back to zero.',
  'Changed',
  'neutral',
);

export const TIMERS: MetricStack = {
  stack: true,
  title: 'Timers',
  blurb: 'Timer pieces set counting down, paused, reset, and given a new length.',
  members: [TIMERS_STARTED, TIMERS_PAUSED, TIMERS_RESET, TIMER_LENGTHS_SET],
  headline: TIMERS_STARTED,
};

export const STOPWATCHES: MetricStack = {
  stack: true,
  title: 'Stopwatches',
  blurb: 'Stopwatch pieces set counting up, paused and reset.',
  members: [STOPWATCHES_STARTED, STOPWATCHES_PAUSED, STOPWATCHES_RESET],
  headline: STOPWATCHES_STARTED,
};

// Calls in a Space (docs/specs/012-collaboration/proximity-audio.md, video-and-screen-bubbles.md and
// meeting-rooms-and-stage.md): joining by voice or to listen, the camera and screen, the stage, and the help a
// call offers. That a call happened and how, never who was in it or what was said.
const call = (type: string, title: string, blurb: string, rising?: 'neutral' | 'bad') =>
  chart('Canvas', 'Used', title, blurb, { types: [type], ...(rising ? { rising } : {}) });

export const CALL_AUDIO_JOINS = call(
  'AudioJoin',
  'Joined by Voice',
  'Someone joined a call in a Space with their microphone, to speak.',
);
export const CALL_LISTEN_JOINS = call(
  'AudioListen',
  'Joined to Listen',
  'Someone joined a call in a Space to listen only.',
);
export const CALL_MUTES = chart(
  'UI',
  'Changed',
  'Mutes and Unmutes',
  'A microphone muted or unmuted in a call.',
  { types: ['AudioMute'], rising: 'neutral' },
);
export const CALL_CAMERAS_ON = call('CameraOn', 'Cameras On', 'A camera switched on in a call.');
export const CALL_SCREENS_SHARED = call(
  'ScreenShare',
  'Screens Shared',
  'Someone shared their screen into a call.',
);
export const CALL_BUBBLES_MAXIMISED = call(
  'BubbleMaximise',
  'Bubbles Maximised',
  'A video or shared screen opened large from its bubble.',
);
export const CALL_SHARES_STOPPED = call(
  'StopOthersShare',
  'Others’ Shares Stopped',
  'An Editor stopped someone else’s screen share.',
  'neutral',
);
export const CALL_WALKS_TO_TALKER = call(
  'WalkToTalker',
  'Walked to a Talker',
  'Someone pressed to walk their avatar over to whoever is talking.',
);
export const CALL_HANDS_RAISED = call(
  'RaiseHand',
  'Hands Raised',
  'A hand raised in a call, to ask to speak.',
);
export const CALL_STAGE_SPEAKERS = call(
  'StageSpeak',
  'Spoke on the Stage',
  'Someone stepped onto a Stage and spoke to the whole room.',
);
export const CALL_LET_SPEAK = call(
  'LetSpeak',
  'Let Speak',
  'A host let someone in the audience speak on the Stage.',
);
export const CALL_NOT_HEARD = call(
  'CallNotHeard',
  'Not Heard',
  'A call refused to carry someone’s voice to a listener it judged out of earshot. A rise can mean false refusals.',
  'bad',
);
export const CALL_RENEWED = call(
  'CallRenewed',
  'Calls Renewed',
  'A call renewed a session Realtime had dropped, so it kept reaching the other people. A rise can mean sessions expiring early.',
  'neutral',
);

export const CALLS: MetricStack = {
  stack: true,
  title: 'Calls',
  blurb:
    'Calls in a Space: joining by voice or to listen, cameras and shared screens, the Stage, and raised hands.',
  members: [
    CALL_AUDIO_JOINS,
    CALL_LISTEN_JOINS,
    CALL_MUTES,
    CALL_CAMERAS_ON,
    CALL_SCREENS_SHARED,
    CALL_BUBBLES_MAXIMISED,
    CALL_SHARES_STOPPED,
    CALL_WALKS_TO_TALKER,
    CALL_HANDS_RAISED,
    CALL_STAGE_SPEAKERS,
    CALL_LET_SPEAK,
    CALL_NOT_HEARD,
    CALL_RENEWED,
  ],
  headline: [CALL_AUDIO_JOINS, CALL_LISTEN_JOINS],
};

// Knocking on a meeting room's door (docs/specs/012-collaboration/knock.md): a knock, and how it was answered.
export const KNOCKS = call('Knock', 'Knocks', 'Someone knocked on a closed meeting room.');
export const KNOCKS_LET_IN = call('KnockLetIn', 'Let In', 'A knock answered by letting them in.');
export const KNOCKS_NOT_NOW = call(
  'KnockNotNow',
  'Not Now',
  'A knock answered with Not Now.',
  'neutral',
);

export const KNOCKING: MetricStack = {
  stack: true,
  title: 'Knocking',
  blurb: 'Knocks on closed meeting rooms, and how they were answered.',
  members: [KNOCKS, KNOCKS_LET_IN, KNOCKS_NOT_NOW],
  headline: KNOCKS,
};
