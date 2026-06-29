'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { MetricGroups, type MetricGroup } from './MetricCards';
import { windowLabel } from './windows';

// Collaboration view (spec/22): how much of the product is used together
// rather than solo — the multiplayer story the other tabs don't tell.
// Sharing + joining (who hands a diagram off and who comes in through the
// link), discussion (comment threads), and teams (workspaces + their
// shared libraries). High-signal for retention / network effects: a
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
