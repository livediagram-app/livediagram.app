// Programmatic access: API tokens and MCP tool calls (docs/specs/017-telemetry/telemetry.md).
// Part of the metric catalogue: import from ../metric-catalogue.

import type { Metric, MetricStack } from '../metric-series';
import { chart } from './helpers';

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

export const AI_TOOLS_CONNECTED: Metric = {
  category: 'Token',
  action: 'Created',
  type: 'MCP',
  title: 'AI Tools Connected',
  blurb: 'AI assistants that connected through the MCP OAuth consent screen.',
};

export const CLI_SIGN_INS: Metric = {
  category: 'Token',
  action: 'Created',
  type: 'Cli',
  title: 'CLI Sign-ins',
  blurb: 'The livedesign CLI signed in, through the browser or with a code on another device.',
};

export const WORKBENCHES_PAIRED: Metric = {
  category: 'Token',
  action: 'Linked',
  type: 'Workbench',
  title: 'Workbenches Paired',
  blurb: 'A token’s owner allowed a developer tool to open their designs.',
};

export const API_TOKEN_ACTIVITY: MetricStack = {
  rising: 'neutral',
  stack: true,
  title: 'API Token Activity',
  blurb:
    'Every token event: created by hand, by an AI tool connecting over MCP, by the CLI signing in, paired with a workbench, and revoked.',
  members: [TOKENS_CREATED, AI_TOOLS_CONNECTED, CLI_SIGN_INS, WORKBENCHES_PAIRED, TOKENS_REVOKED],
};

// MCP tool calls, one chart per tool the MCP server registers (apps/mcp
// tools.ts), by the `Mcp·Used·<Tool>` token it reports on a call that
// succeeded. Together they are every tool call, so the stack's sum is the
// total; `metric-series.test` fails if a registered tool has no chart here.
const mcpTool = (type: string, title: string, blurb: string): Metric => ({
  category: 'Mcp',
  action: 'Used',
  type,
  title,
  blurb,
});

export const MCP_TOOL_METRICS: readonly Metric[] = [
  mcpTool('FindDesigns', 'Find Designs', 'Searching the user’s designs by name.'),
  mcpTool('ReadDesign', 'Read Design', 'Reading one design’s tabs and elements.'),
  mcpTool('ListTemplates', 'List Templates', 'Listing the templates a design can start from.'),
  mcpTool('SearchIcons', 'Search Icons', 'Finding icons by name for diagram boxes.'),
  mcpTool(
    'ListImages',
    'List Images',
    'Listing the user’s image gallery, to place their pictures.',
  ),
  mcpTool('CreateDesign', 'Create Design', 'Making a new design.'),
  mcpTool('AddTab', 'Add Tab', 'Adding a tab to an existing design.'),
  mcpTool('UpdateDesign', 'Update Design', 'Editing a design’s elements.'),
  mcpTool('ShareDesign', 'Share Design', 'Creating a share link for a design.'),
  mcpTool('RenameDesign', 'Rename Design', 'Renaming a design.'),
  mcpTool('DeleteDesign', 'Delete Design', 'Moving a design to the Trash, or deleting one tab.'),
  mcpTool('ListTrash', 'List Trash', 'Listing the designs in the Trash.'),
  mcpTool('RestoreDesign', 'Restore Design', 'Bringing a design back from the Trash.'),
  mcpTool(
    'ChangePages',
    'Change Pages',
    'Adding, changing, laying out, moving or deleting pages: slides, logos, infographics.',
  ),
];

export const MCP_TOOL_CALLS: MetricStack = {
  stack: true,
  title: 'MCP Tool Calls',
  blurb:
    'AI assistants calling the livedesign MCP server, by tool. Only calls that succeeded count.',
  members: [...MCP_TOOL_METRICS],
};

// Agent changesets (docs/specs/024-agents/agent-changesets.md "Observability and telemetry"):
// how agents change designs, how often they meet a person's work, and how often people undo it.
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

// Design views (docs/specs/024-agents/design-views.md): which views agents read a design through.
export const AGENT_VIEWED = chart(
  'Agent',
  'Viewed',
  'Agent Views Read',
  'A design read as text by an agent or a script: an outline, a graph, a layout and so on.',
);

export const AGENT_CHANGESETS: MetricStack = {
  stack: true,
  title: 'Agent changes',
  blurb: 'Agents changing designs, meeting people’s work, and being undone.',
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
