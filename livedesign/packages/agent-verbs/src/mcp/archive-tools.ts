// archive_design and unarchive_design, and find_designs' `archived` (docs/specs/015-api/mcp-server.md
// "Archived"): the shared Archived tools (@liveworkspace/agent-verbs/mcp/archive-tools) in this product's words.
import { createArchiveTools } from '@liveworkspace/agent-verbs/mcp/archive-tools';
import { AGENT_PRODUCT } from '../agent-product';

export const {
  archive: mcpArchiveDesign,
  unarchive: mcpUnarchiveDesign,
  findArchived,
  foundArchived,
} = createArchiveTools(AGENT_PRODUCT, 'designId');

// Their outputs by name, as the other tools' are (output-schema.ts).
export const archiveDesignOutput = mcpArchiveDesign.mcpShapes.output;
export const unarchiveDesignOutput = mcpUnarchiveDesign.mcpShapes.output;
