// archive_project and unarchive_project, and find_projects' `archived` (docs/specs/015-api/mcp-server.md
// "Archived"): the shared Archived tools (@liveworkspace/agent-verbs/mcp/archive-tools) in this product's words.
import { createArchiveTools } from '@liveworkspace/agent-verbs/mcp/archive-tools';
import { AGENT_PRODUCT } from '../agent-product';

export const {
  archive: mcpArchiveProject,
  unarchive: mcpUnarchiveProject,
  findArchived,
  foundArchived,
} = createArchiveTools(AGENT_PRODUCT, 'projectId');

// Their outputs by name, as the other tools' are (output-schema.ts).
export const archiveProjectOutput = mcpArchiveProject.mcpShapes.output;
export const unarchiveProjectOutput = mcpUnarchiveProject.mcpShapes.output;
