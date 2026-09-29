// Programmatic access: API tokens and MCP tool calls (docs/specs/017-telemetry/telemetry.md).
// Part of the metric catalogue: import from ../metric-catalogue.

import type { Metric, MetricStack } from '../metric-series';

// Programmatic access (Dashboard, Connections): the API-token lifecycle and
// what the MCP server's tools actually get used for.
export const TOKENS_CREATED: Metric = {
  category: 'Token',
  action: 'Created',
  type: 'Manual',
  title: 'Tokens Created',
  blurb: 'Personal API tokens created by hand from the Explorer.',
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
  blurb: 'API tokens revoked, whether created by hand or by an AI tool.',
};

export const API_TOKEN_ACTIVITY: MetricStack = {
  rising: 'neutral',
  stack: true,
  title: 'API Token Activity',
  blurb:
    'Every token event: created by hand, created by an AI tool connecting over MCP, and revoked.',
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
  mcpTool('FindDocuments', 'Find Documents', 'Searching the user’s documents by name.'),
  mcpTool('ReadDocument', 'Read Document', 'Reading one document’s tabs and elements.'),
  mcpTool('ListTemplates', 'List Templates', 'Listing the templates a document can start from.'),
  mcpTool('CreateDocument', 'Create Document', 'Making a new document.'),
  mcpTool('AddTab', 'Add Tab', 'Adding a tab to an existing document.'),
  mcpTool('UpdateDocument', 'Update Document', 'Editing a document’s elements.'),
  mcpTool('ShareDocument', 'Share Document', 'Creating a share link for a document.'),
  mcpTool('RenameDocument', 'Rename Document', 'Renaming a document.'),
  mcpTool(
    'DeleteDocument',
    'Delete Document',
    'Moving a document to the Trash, or deleting one tab.',
  ),
  mcpTool('ListTrash', 'List Trash', 'Listing the documents in the Trash.'),
  mcpTool('RestoreDocument', 'Restore Document', 'Bringing a document back from the Trash.'),
];

export const MCP_TOOL_CALLS: MetricStack = {
  stack: true,
  title: 'MCP Tool Calls',
  blurb:
    'AI assistants calling the livediagram MCP server, by tool. Only calls that succeeded count.',
  members: [...MCP_TOOL_METRICS],
};
