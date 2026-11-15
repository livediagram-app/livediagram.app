// list_versions and restore_version (docs/specs/015-api/mcp-server.md §4.9e; docs/specs/006-document/
// version-history.md "MCP"): a tab's earlier versions, and making one the tab's content again. The handlers live in
// the MCP (apps/mcp/src/version-tools.ts) over the api's version doors.
import { z } from 'zod';
import { VERSION_KINDS } from '@livedocuments/api-schema';
import { mcpTool } from '@liveworkspace/agent-verbs/mcp/tool';

const documentId = z.string().describe('The document (from find_documents).');
const url = z.string().describe('Link that opens the document in the livedocuments editor.');

const version = z.object({
  id: z.string().describe('The version, for restore_version.'),
  rev: z.number().int().describe('The tab revision it holds.'),
  kind: z
    .enum(VERSION_KINDS)
    .describe(
      'Why it was kept: idle (after a pause in editing), agent (before an agent changed the tab), restore (the ' +
        'content a restore replaced) or manual (named by a person).',
    ),
  name: z.string().nullable().describe('Its name, or null when unnamed.'),
  author: z
    .string()
    .nullable()
    .describe('Who last changed the tab before it was kept, when known.'),
  savedAt: z.string().describe('When the content was last changed, ISO 8601.'),
});

export const listVersionsShape = {
  documentId,
  tabId: z.string().optional().describe('The tab. Absent: the first tab.'),
};

export const listVersionsOutput = {
  documentId: z.string().describe('The document.'),
  tabId: z.string().describe('The tab the versions are of.'),
  tabName: z.string().describe('The tab name.'),
  versions: z.array(version).describe('Newest first.'),
  url,
};

export const restoreVersionShape = {
  documentId,
  tabId: z.string().describe('The tab the version is of.'),
  versionId: z.string().describe('The version (from list_versions).'),
};

export const restoreVersionOutput = {
  restored: z.boolean().describe('False when the version was already the tab’s content.'),
  tabId: z.string().describe('The tab restored.'),
  rev: z.number().int().optional().describe('The tab’s revision after the restore.'),
  changesetId: z
    .string()
    .nullable()
    .optional()
    .describe('The changeset the restore made, when elements changed.'),
  undoVersionId: z
    .string()
    .optional()
    .describe('The content the restore replaced: restore this version to take the restore back.'),
  url,
};

export const mcpListVersions = mcpTool('list_versions', {
  behaviour: 'read',
  title: 'List versions',
  description:
    'List the earlier versions of one tab, newest first: kept after a pause in editing, before each agent ' +
    'change, before a restore, and when a person named one. Each has an id for restore_version, its kind, ' +
    'name and when the content was last changed.',
  inputSchema: listVersionsShape,
  outputSchema: listVersionsOutput,
});

export const mcpRestoreVersion = mcpTool('restore_version', {
  behaviour: 'destructive',
  title: 'Restore a version',
  description:
    'Make an earlier version (from list_versions) the tab’s content again, as one changeset by the user that ' +
    'everyone with the tab open sees at once. The tab keeps its name and the comments on what it keeps. ' +
    'Answers undoVersionId: restore it to take this restore back. Needs edit access.',
  inputSchema: restoreVersionShape,
  outputSchema: restoreVersionOutput,
});
