// Programmatic access: API tokens and agent changes (docs/specs/017-telemetry/telemetry.md).
// Part of the metric catalogue: import from ../metric-catalogue.

import type { Metric, MetricStack } from '../../_shared/metric-series';
import { chart } from '../../_shared/catalogue-helpers';

// Tokens made by hand and revoked on liveworkspace.app, counted by accounts under the app their owner signed up
// through.
export const TOKENS_CREATED: Metric = {
  category: 'Token',
  action: 'Created',
  type: 'Manual',
  title: 'Tokens Created',
  blurb: 'Personal API tokens created by hand on liveworkspace.app.',
};

export const TOKENS_REVOKED: Metric = {
  rising: 'neutral',
  category: 'Token',
  action: 'Removed',
  type: null,
  title: 'Tokens Revoked',
  blurb: 'API tokens revoked by hand on liveworkspace.app.',
};

export const API_TOKEN_ACTIVITY: MetricStack = {
  rising: 'neutral',
  stack: true,
  title: 'API Token Activity',
  blurb: 'Every token event: created by hand, and revoked.',
  members: [TOKENS_CREATED, TOKENS_REVOKED],
};

// Agent changesets (docs/specs/024-agents/agent-changesets.md "Observability and telemetry"):
// how agents change documents, how often they meet a person's work, and how often people undo it.
export const AGENT_APPLIED = chart(
  'Agent',
  'Applied',
  'Agent Changes Applied',
  'An agent changed a tab with a changeset, through the MCP server, the CLI or the API.',
);

export const AGENT_CONFLICTED = chart(
  'Agent',
  'Conflicted',
  'Agent Changes in Conflict',
  'A changeset refused because something it touched changed since the agent read it.',
  { rising: 'neutral' },
);

export const AGENT_HELD = chart(
  'Agent',
  'Held',
  'Agent Changes Held',
  'A changeset refused because a person had one of its elements selected.',
  { rising: 'neutral' },
);

export const AGENT_PRESENT = chart(
  'Agent',
  'Present',
  'Agents Present',
  'An agent showed itself on a tab, with a status line, for the people there to see.',
  { rising: 'neutral' },
);

export const AGENT_REVERTED = chart(
  'Agent',
  'Reverted',
  'Agent Changes Undone',
  "An agent's changeset reverted, from the editor's Undo or another front door.",
  { rising: 'bad' },
);

export const AGENT_TOAST_SHOW = chart(
  'Agent',
  'Opened',
  'Agent Changes Shown',
  "Somebody pressed Show on an agent's toast to see what it changed.",
  { types: ['Toast'] },
);

// Document views (docs/specs/024-agents/document-views.md): which views agents read a document through.
export const AGENT_VIEWED = chart(
  'Agent',
  'Viewed',
  'Agent Views Read',
  'A document read as text by an agent or a script: an outline, a graph, a layout and so on.',
);

export const AGENT_CHANGESETS: MetricStack = {
  stack: true,
  title: 'Agent changes',
  blurb: 'Agents changing documents, meeting people’s work, and being undone.',
  headline: AGENT_APPLIED,
  members: [
    AGENT_APPLIED,
    AGENT_CONFLICTED,
    AGENT_HELD,
    AGENT_REVERTED,
    AGENT_TOAST_SHOW,
    AGENT_PRESENT,
  ],
};
