'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { AI_TURNED_ON } from './metric-catalogue';
import { MetricGroups, type MetricGroup } from './MetricCards';
import { windowLabel } from './windows';

// Editing view (spec/22): the in-editor tools that organise work rather than
// draw it: the AI opt-in, notes, folders, assigned actions. AI usage and
// layers moved to Highlights as the AI Assistance and Layers Feature stacks.
//
// Every metric here was already being emitted, validated, and stored, and none
// of it was rendered anywhere: `AI·Used` had no card on any tab, and the whole
// `Layer` category (spec/74), plus Note, Folder and Action, appeared only in
// the vocabulary labeller the Raw table uses. Data arriving and nobody reading
// it is the same blind spot as data never sent, one step further along — the
// Palette catalogue drifting out of the dashboard is exactly how four element
// kinds came to count zero (spec/22, "How completeness is tested").
//
// Aggregates where the type split is arbitrary for this lens, specific where
// the type carries the meaning (the AI opt-in is On vs Off, and only On is
// the signal).
export const GROUPS: MetricGroup[] = [
  {
    title: 'AI',
    metrics: [AI_TURNED_ON],
  },
  {
    title: 'Notes & actions',
    metrics: [
      {
        category: 'Note',
        action: 'Added',
        type: null,
        title: 'Notes Added',
        blurb: "An element's note went from empty to written (spec/22).",
      },
      {
        category: 'Note',
        action: 'Opened',
        type: null,
        title: 'Notes Opened',
        blurb: 'The note popover was opened, to read as well as to write.',
      },
      {
        category: 'Action',
        action: 'Created',
        allTypes: true,
        title: 'Actions Assigned',
        blurb:
          'Element-level work assigned to a teammate (spec/68), with or without the email notification.',
      },
      {
        category: 'Action',
        action: 'Created',
        type: 'EmailOn',
        title: 'Of Those, Emailed',
        blurb:
          'Assigned with the notify-by-email box ticked. A subset of the count beside it. Counts the box, not a sent email: sends are Action Notifications in the Emails Sent stack on Highlights.',
      },
      {
        category: 'Action',
        action: 'Resolved',
        type: null,
        title: 'Actions Completed',
        blurb: 'Read against actions assigned: the follow-through rate on the feature.',
      },
    ],
  },
  {
    title: 'Organisation',
    metrics: [
      {
        category: 'Folder',
        action: 'Created',
        // Explorer folders plus team-library ones; tab folders have their own card below.
        typeIn: (type) => type !== 'Tab',
        title: 'Folders Created',
        blurb: 'Folders of diagrams, in your own Explorer or a team library.',
      },
      {
        category: 'Folder',
        action: 'Moved',
        allTypes: true,
        title: 'Folders Re-parented',
        blurb: 'A folder nested under another, or promoted back to the root.',
      },
      // Tab folders (spec/30) are the same instinct one level down, so they read
      // beside diagram filing. Both are typed rather than bare because the bare
      // Tab/Folder events belong to different subjects: see the type note in
      // spec/22's Folder entry.
      {
        category: 'Folder',
        action: 'Created',
        type: 'Tab',
        title: 'Tab Folders Created',
        blurb: 'A collapsible folder of tab pills created inside one diagram.',
      },
      {
        category: 'Tab',
        action: 'Moved',
        type: 'Folder',
        title: 'Tabs Filed',
        blurb:
          'A tab filed into a tab folder, by the ellipsis menu or by a drag (both report identically).',
      },
      {
        category: 'Diagram',
        action: 'Moved',
        allTypes: true,
        title: 'Diagrams Filed',
        blurb:
          'A diagram moved into a folder, back to Unsorted, or between the cloud and offline storage (spec/76).',
      },
    ],
  },
];

export function EditingView({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        The tools that organise the work rather than draw it, for{' '}
        <span className="font-medium">{windowLabel(active)}</span>: the AI opt-in, notes, assigned
        actions, and folders. AI Assistance and Layers are stacks on Highlights.
      </p>
      <MetricGroups groups={GROUPS} summary={summary} active={active} />
    </div>
  );
}
