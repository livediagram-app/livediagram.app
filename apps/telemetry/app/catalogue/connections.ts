// Programmatic access: API tokens and MCP tool calls (docs/specs/017-telemetry/telemetry.md).
// Part of the metric catalogue: import from ../metric-catalogue.

import type { Metric, MetricStack } from '../metric-series';
import { chart } from './helpers';

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
  mcpTool('FindDiagrams', 'Find Diagrams', 'Searching the user’s diagrams by name.'),
  mcpTool('ReadDiagram', 'Read Diagram', 'Reading one diagram’s tabs and elements.'),
  mcpTool('ListTemplates', 'List Templates', 'Listing the templates a diagram can start from.'),
  mcpTool('CreateDiagram', 'Create Diagram', 'Making a new diagram.'),
  mcpTool('AddTab', 'Add Tab', 'Adding a tab to an existing diagram.'),
  mcpTool('UpdateDiagram', 'Update Diagram', 'Editing a diagram’s elements.'),
  mcpTool('ShareDiagram', 'Share Diagram', 'Creating a share link for a diagram.'),
  mcpTool('RenameDiagram', 'Rename Diagram', 'Renaming a diagram.'),
  mcpTool('DeleteDiagram', 'Delete Diagram', 'Moving a diagram to the Trash, or deleting one tab.'),
  mcpTool('ListTrash', 'List Trash', 'Listing the diagrams in the Trash.'),
  mcpTool('RestoreDiagram', 'Restore Diagram', 'Bringing a diagram back from the Trash.'),
];

export const MCP_TOOL_CALLS: MetricStack = {
  stack: true,
  title: 'MCP Tool Calls',
  blurb:
    'AI assistants calling the livediagram MCP server, by tool. Only calls that succeeded count.',
  members: [...MCP_TOOL_METRICS],
};

// The Google Drive mirror (docs/specs/022-drive-mirror/drive-mirror.md, "Telemetry"):
// who connects it, whether it stays connected, and what flows back from Drive.
export const DRIVE_CONNECTED = chart(
  'Drive',
  'Linked',
  'Drive Connected',
  'Someone connected Google Drive to mirror their Personal Space.',
);

export const DRIVE_DISCONNECTED = chart(
  'Drive',
  'Unlinked',
  'Drive Disconnected',
  'Someone disconnected Google Drive. Their files stay in Drive.',
  { rising: 'neutral' },
);

export const DRIVE_NEEDS_RECONNECT = chart(
  'Drive',
  'Changed',
  'Drive Needs Reconnecting',
  'Google stopped accepting a mirror’s access (revoked, or unused for six months).',
  { types: ['NeedsReconnect'], rising: 'bad' },
);

export const DRIVE_FIRST_MIRROR = chart(
  'Drive',
  'Created',
  'First Mirrors Finished',
  'A newly connected Personal Space finished copying every diagram into Drive.',
  { types: ['FirstMirror'] },
);

export const DRIVE_CHANGES_APPLIED = chart(
  'Drive',
  'Applied',
  'Changes From Drive',
  'A rename, move, bin, restore or permanent delete made in Google Drive, applied here.',
);

export const DRIVE_OPEN_WITH = chart(
  'Drive',
  'Opened',
  'Opened From Drive',
  'A file opened with livediagram from Google Drive: opened, offered as a copy, or unreadable.',
);

export const DRIVE_MIRROR: MetricStack = {
  stack: true,
  title: 'Google Drive',
  blurb: 'Personal Spaces mirrored to Google Drive, and what comes back from Drive.',
  headline: DRIVE_CONNECTED,
  members: [
    DRIVE_CONNECTED,
    DRIVE_FIRST_MIRROR,
    DRIVE_CHANGES_APPLIED,
    DRIVE_OPEN_WITH,
    DRIVE_NEEDS_RECONNECT,
    DRIVE_DISCONNECTED,
  ],
};
