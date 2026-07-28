'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { MetricGroups, type MetricGroup } from './MetricCards';
import { windowLabel } from './windows';

// Collaboration view (spec/22): how much of the product is used together
// rather than solo — the multiplayer story the other tabs don't tell.
// Sharing + joining (who hands a diagram off and who comes in through the
// link), discussion (comment threads), teams (workspaces + their shared
// libraries), and the live session tools a facilitator runs in front of a
// room — voting, polls, timers. High-signal for retention / network effects: a
// diagram that gets shared and joined is worth far more than one that
// never leaves a single browser.
const GROUPS: MetricGroup[] = [
  {
    title: 'Sharing & joining',
    metrics: [
      { category: 'Diagram', action: 'Shared', type: 'Edit', title: 'Edit Links Shared' },
      { category: 'Diagram', action: 'Shared', type: 'View', title: 'View Links Shared' },
      { category: 'Diagram', action: 'Joined', type: 'Edit', title: 'Collaborators Joined' },
      { category: 'Diagram', action: 'Joined', type: 'View', title: 'Viewers Joined' },
    ],
  },
  {
    title: 'Discussion',
    metrics: [
      { category: 'Comment', action: 'Added', type: null, title: 'Comments Added' },
      { category: 'Comment', action: 'Opened', type: null, title: 'Threads Opened' },
      { category: 'Comment', action: 'Resolved', type: null, title: 'Comments Resolved' },
    ],
  },
  {
    title: 'Teams',
    metrics: [
      {
        category: 'Team',
        action: 'Created',
        type: null,
        title: 'Teams Created',
        blurb: 'A new team workspace was created.',
      },
      {
        category: 'Team',
        action: 'Added',
        type: 'Member',
        title: 'Members Added',
        blurb: 'Someone was added to a team (by invite or accepted invitation).',
      },
      {
        category: 'Team',
        action: 'Added',
        type: 'Diagram',
        title: 'Diagrams Shared to a Team',
        blurb: "A diagram was moved into a team's shared library for everyone on the team.",
      },
    ],
  },
  // Live session tools (spec/39 + spec/88): the facilitation features, which
  // only make sense with a room in front of you and so belong with the rest
  // of the multiplayer story rather than in a tab of their own. Each pair is
  // deliberately readable AGAINST its neighbour — votes started vs ended,
  // dots cast vs retracted, timers started vs finished — because for these
  // the interesting number isn't the count, it's the drop-off.
  {
    title: 'Voting',
    metrics: [
      {
        category: 'Tab',
        action: 'Started',
        type: 'Vote',
        title: 'Votes Started',
        blurb: 'A facilitator opened a dot-vote on a tab.',
      },
      {
        category: 'Tab',
        action: 'Started',
        type: 'PrivateVote',
        title: 'Of Those, Private',
        blurb:
          'Started with hidden cursors or hidden running counts. A subset of the count beside it, not a separate vote.',
      },
      {
        category: 'Element',
        action: 'Voted',
        type: null,
        title: 'Dots Cast',
        blurb: 'A participant placed a dot on an element.',
      },
      {
        category: 'Element',
        action: 'Removed',
        type: 'Vote',
        title: 'Dots Retracted',
        blurb:
          'A participant took a dot back. Read against dots cast to see how much reconsidering happens.',
      },
      {
        category: 'Tab',
        action: 'Revealed',
        type: 'Vote',
        title: 'Results Revealed',
        blurb:
          'The facilitator showed the tallies. A vote started but never revealed is one that fizzled.',
      },
      {
        category: 'Tab',
        action: 'Cleared',
        type: 'Vote',
        title: 'Votes Discarded',
        blurb:
          'The whole round was thrown away, dots and all — distinct from ending it, which keeps the tallies.',
      },
    ],
  },
  {
    title: 'Polls',
    metrics: [
      {
        category: 'Tab',
        action: 'Started',
        type: 'Poll',
        title: 'Polls Started',
        blurb:
          'A live pulse-check was opened on a tab (spec/88). Nothing about a poll is persisted.',
      },
      {
        category: 'Tab',
        action: 'Voted',
        type: 'Poll',
        title: 'Poll Answers',
        blurb: 'A participant answered. Read against polls started for average turnout.',
      },
      {
        category: 'Tab',
        action: 'Ended',
        type: 'Poll',
        title: 'Polls Ended',
        blurb: 'The facilitator closed the poll.',
      },
    ],
  },
  {
    title: 'Timers',
    metrics: [
      {
        category: 'Tab',
        action: 'Started',
        type: 'CountdownTimer',
        title: 'Countdowns Started',
        blurb: 'A timebox was set running on a tab.',
      },
      {
        category: 'Tab',
        action: 'Started',
        type: 'StopwatchTimer',
        title: 'Stopwatches Started',
        blurb: 'A count-up timer was set running.',
      },
      {
        category: 'Tab',
        action: 'Toggled',
        type: 'TimerPaused',
        title: 'Timers Paused',
        blurb:
          'Paused mid-run. Heavy pausing suggests the timebox rarely survives contact with the meeting.',
      },
      {
        category: 'Tab',
        action: 'Changed',
        type: 'TimerReset',
        title: 'Timers Reset',
        blurb: 'Returned to its starting value — usually a second round of the same exercise.',
      },
      {
        category: 'Tab',
        action: 'Ended',
        type: 'CountdownTimer',
        title: 'Countdowns Finished',
        blurb:
          'Dismissed from the tab. Read against countdowns started to see how many get abandoned.',
      },
      {
        category: 'Tab',
        action: 'Ended',
        type: 'StopwatchTimer',
        title: 'Stopwatches Finished',
        blurb: 'Dismissed from the tab.',
      },
    ],
  },
];

export function CollaborationView({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        How much work happens together rather than solo, for{' '}
        <span className="font-medium">{windowLabel(active)}</span> — sharing, joining, comment
        threads, and teams.
      </p>
      <MetricGroups groups={GROUPS} summary={summary} active={active} />
    </div>
  );
}
