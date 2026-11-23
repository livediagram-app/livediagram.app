// Start a Call Here's charts and sentences (liveworkspace/docs/specs/004-index/item-calls.md "Telemetry"). The item's
// side (Call, Join, Meetings) is shared workbench code, so its events are the same in every app but livehuddle, sent
// under that app's own name; the call's side (Open Item, Invite, Wrap Up) is livehuddle's own. The type is the
// feature's, never an item, a person or any words.

import type { Metric, MetricStack } from './metric-series';

export const ITEM_CALL_STARTED: Metric = {
  category: 'UI',
  action: 'Started',
  type: 'ItemCall',
  title: 'Calls Started',
  blurb: 'Call pressed in an editor, a livehuddle call about the item opened in a new tab.',
};

export const ITEM_CALL_JOINED: Metric = {
  category: 'UI',
  action: 'Opened',
  type: 'ItemCall',
  title: 'Calls Joined',
  blurb: "Join pressed on an item's call pill or in Meetings, the call brought up in its own tab.",
};

export const ITEM_CALL_REFUSED: Metric = {
  category: 'UI',
  action: 'Refused',
  type: 'ItemCall',
  title: 'Calls Refused',
  blurb:
    'A call that could not start: the tab was blocked, a limit was reached, or the index turned it away.',
  rising: 'bad',
};

export const MEETINGS_OPENED: Metric = {
  category: 'UI',
  action: 'Opened',
  type: 'Meetings',
  title: 'Meetings Opened',
  blurb: "Meetings opened from Tools, listing an item's calls with their summaries and actions.",
};

export const MEETING_SUMMARY_OPENED: Metric = {
  category: 'UI',
  action: 'Opened',
  type: 'MeetingSummary',
  title: 'Summaries Opened',
  blurb: "A call's summary page opened from Meetings.",
};

export const ITEM_CALLS: MetricStack = {
  stack: true,
  title: 'Start a Call Here',
  blurb:
    'Video calls about an item, in livehuddle: how often a call starts or is joined from the item, how often one is refused, and how often its Meetings and summaries are read afterwards.',
  headline: ITEM_CALL_STARTED,
  members: [
    ITEM_CALL_STARTED,
    ITEM_CALL_JOINED,
    ITEM_CALL_REFUSED,
    MEETINGS_OPENED,
    MEETING_SUMMARY_OPENED,
  ],
};

export const CALL_ITEM_OPENED: Metric = {
  category: 'UI',
  action: 'Opened',
  type: 'CallItem',
  title: 'Items Opened',
  blurb: "Open Item pressed in a call's Space, bringing back the item the call is about.",
};

export const CALL_INVITE_SENT: Metric = {
  category: 'UI',
  action: 'Created',
  type: 'CallInvite',
  title: 'Invites Sent',
  blurb: 'Invites sent from a call to teammates, each landing in their Inbox.',
};

export const CALL_SUMMARY_SENT: Metric = {
  category: 'UI',
  action: 'Created',
  type: 'CallSummary',
  title: 'Summaries Sent',
  blurb: "A call's Wrap Up summary sent to a liveknowledge knowledgebase as a page.",
};

export const CALL_SUMMARY_AI: Metric = {
  category: 'UI',
  action: 'Used',
  type: 'CallSummaryAi',
  title: 'Summaries Written With AI',
  blurb:
    'Write With AI pressed in Wrap Up, the draft rewritten from the notes. Read against summaries sent.',
};

export const CALLS_FROM_ITEMS: MetricStack = {
  stack: true,
  title: 'Calls About Items',
  blurb:
    'Calls started from an item in another app: how often the item is opened from the call, invites are sent, and Wrap Up sends a summary, written with AI or by hand.',
  headline: CALL_SUMMARY_SENT,
  members: [CALL_ITEM_OPENED, CALL_INVITE_SENT, CALL_SUMMARY_SENT, CALL_SUMMARY_AI],
};

// The sentences, in the `Category|Action|Type` shape each app's EXACT explanation table takes.
export const ITEM_CALL_EXACT: Readonly<Record<string, string>> = {
  'UI|Started|ItemCall': 'Someone started a livehuddle call about the item, in a new tab.',
  'UI|Opened|ItemCall': "Someone joined an item's call, from its pill or from Meetings.",
  'UI|Refused|ItemCall':
    'A call about the item could not start: a blocked tab, a limit or a refusal.',
  'UI|Opened|Meetings': "Someone opened Meetings to see the item's calls.",
  'UI|Opened|MeetingSummary': "Someone opened a call's summary page from Meetings.",
};

export const CALL_FROM_ITEM_EXACT: Readonly<Record<string, string>> = {
  'UI|Opened|CallItem': "Someone opened the item a call is about, from the call's Space.",
  'UI|Created|CallInvite': 'Someone invited teammates to a call about an item.',
  'UI|Created|CallSummary': "Someone sent a call's summary to a knowledgebase.",
  'UI|Used|CallSummaryAi': "Someone had AI write a call's summary from its notes.",
};
