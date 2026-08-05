'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { MetricGroups, type MetricGroup } from './MetricCards';
import { windowLabel } from './windows';

// Editing view (spec/22): the in-editor tools that organise work rather than
// draw it — AI assistance, layers, notes, folders, assigned actions.
//
// Every metric here was already being emitted, validated, and stored, and none
// of it was rendered anywhere: `AI·Used` had no card on any tab, and the whole
// `Layer` category (spec/74), plus Note, Folder and Action, appeared only in
// the vocabulary labeller the Raw table uses. Data arriving and nobody reading
// it is the same blind spot as data never sent, one step further along — the
// Palette catalogue drifting out of the dashboard is exactly how four element
// kinds came to count zero (spec/22, "How completeness is tested").
//
// Aggregates where the type split is arbitrary for this lens (all AI modes,
// all layer visibility toggles), specific where the type carries the meaning
// (the AI panel opt-in is On vs Off, and only On belongs beside usage).
const GROUPS: MetricGroup[] = [
  {
    title: 'AI assistance',
    metrics: [
      {
        category: 'AI',
        action: 'Used',
        allTypes: true,
        title: 'AI Requests',
        blurb:
          'A completed request in the editor AI panel, across both modes (Ask, Clean). Refusals and failures are not counted (spec/25).',
      },
      {
        category: 'AI',
        action: 'Used',
        type: 'Ask',
        title: 'Of Those, Ask',
        blurb: 'Read-only questions about the diagram. A subset of the count beside it.',
      },
      {
        category: 'AI',
        action: 'Used',
        type: 'Clean',
        title: 'Of Those, Clean',
        blurb: 'Tidy-the-tab runs, the one mode that changes the canvas.',
      },
      {
        category: 'UI',
        action: 'Toggled',
        type: 'AiOn',
        title: 'AI Turned On',
        blurb:
          'The Settings opt-in. AI is off until a user asks for it, so this is the population every request above comes from.',
      },
    ],
  },
  {
    title: 'Layers',
    metrics: [
      {
        category: 'Layer',
        action: 'Added',
        type: null,
        title: 'Layers Created',
        blurb: 'A new layer on a tab (spec/74).',
      },
      {
        category: 'Layer',
        action: 'Toggled',
        allTypes: true,
        title: 'Visibility & Lock Toggles',
        blurb:
          'The eye and the padlock, across hide / show / lock / unlock. The gesture layers are actually for.',
      },
      {
        category: 'Layer',
        action: 'Moved',
        type: null,
        title: 'Selections Moved to a Layer',
        blurb: 'Elements sent to another layer — layers being used to organise, not just to hide.',
      },
      {
        category: 'Layer',
        action: 'Deleted',
        type: null,
        title: 'Layers Deleted',
      },
      {
        category: 'Layer',
        action: 'Opened',
        type: null,
        title: 'Layers Panel Opened',
        blurb: 'Read against the layer counts: a panel opened far more often than used is a hint.',
      },
    ],
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
        blurb: 'The note popover was opened — reading as well as writing.',
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
        blurb: 'Assigned with the notify-by-email box ticked. A subset of the count beside it.',
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
        type: null,
        title: 'Folders Created',
      },
      {
        category: 'Folder',
        action: 'Moved',
        type: null,
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
          'A tab filed into a tab folder, by the ellipsis menu or by a drag — both report identically.',
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
        <span className="font-medium">{windowLabel(active)}</span> — AI assistance, layers, notes,
        assigned actions, and folders.
      </p>
      <MetricGroups groups={GROUPS} summary={summary} active={active} />
    </div>
  );
}
