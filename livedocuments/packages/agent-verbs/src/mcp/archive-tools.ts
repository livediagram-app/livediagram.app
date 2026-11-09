// archive_document and unarchive_document, and find_documents' `archived` (docs/specs/015-api/mcp-server.md
// "Archived"): the shared Archived tools (@liveworkspace/agent-verbs/mcp/archive-tools) in this product's words.
import { createArchiveTools } from '@liveworkspace/agent-verbs/mcp/archive-tools';
import { AGENT_PRODUCT } from '../agent-product';

export const {
  archive: mcpArchiveDocument,
  unarchive: mcpUnarchiveDocument,
  findArchived,
  foundArchived,
} = createArchiveTools(AGENT_PRODUCT, 'documentId');

// Their outputs by name, as the other tools' are (output-schema.ts).
export const archiveDocumentOutput = mcpArchiveDocument.mcpShapes.output;
export const unarchiveDocumentOutput = mcpUnarchiveDocument.mcpShapes.output;
