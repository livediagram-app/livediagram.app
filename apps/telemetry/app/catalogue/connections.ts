// Programmatic access: API tokens and MCP tool calls (spec/22).
// Part of the metric catalogue: import from ../metric-catalogue.

import type { Metric, MetricStack } from '../metric-series';

// Programmatic access (Dashboard, Connections): the API-token lifecycle and
// what the MCP server's tools actually get used for.
export const TOKENS_CREATED: Metric = {
  category: 'Token',
  action: 'Created',
  type: 'Manual',
  title: 'Tokens Created',
  blurb: 'Personal API tokens minted by hand from the Explorer.',
};

export const AI_TOOLS_CONNECTED: Metric = {
  category: 'Token',
  action: 'Created',
  type: 'MCP',
  title: 'AI Tools Connected',
  blurb: 'AI assistants that connected through the MCP OAuth consent screen.',
};

export const TOKENS_REVOKED: Metric = {
  rising: 'neutral',
  category: 'Token',
  action: 'Removed',
  type: null,
  title: 'Tokens Revoked',
  blurb: 'API tokens revoked, whether minted by hand or by an AI tool.',
};

export const API_TOKEN_ACTIVITY: MetricStack = {
  rising: 'neutral',
  stack: true,
  title: 'API Token Activity',
  blurb:
    'Every token event: minted by hand, minted by an AI tool connecting over MCP, and revoked.',
  members: [TOKENS_CREATED, AI_TOOLS_CONNECTED, TOKENS_REVOKED],
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
  mcpTool('FindDiagrams', 'Find Diagrams', 'Searching the user’s diagrams by name.'),
  mcpTool('ReadDiagram', 'Read Diagram', 'Reading one diagram’s tabs and elements.'),
  mcpTool('ListTemplates', 'List Templates', 'Listing the templates a diagram can start from.'),
  mcpTool('CreateDiagram', 'Create Diagram', 'Making a new diagram.'),
  mcpTool('AddTab', 'Add Tab', 'Adding a tab to an existing diagram.'),
  mcpTool('UpdateDiagram', 'Update Diagram', 'Editing a diagram’s elements.'),
  mcpTool('ShareDiagram', 'Share Diagram', 'Creating a share link for a diagram.'),
  mcpTool('RenameDiagram', 'Rename Diagram', 'Renaming a diagram.'),
  mcpTool('DeleteDiagram', 'Delete Diagram', 'Deleting a diagram.'),
];

export const MCP_TOOL_CALLS: MetricStack = {
  stack: true,
  title: 'MCP Tool Calls',
  blurb:
    'AI assistants calling the livediagram MCP server, by tool. Only calls that succeeded count.',
  members: [...MCP_TOOL_METRICS],
};
