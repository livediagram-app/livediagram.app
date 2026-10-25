// The sweep of the caller's documents the MCP's find_documents and the CLI's addressing share
// (@liveworkspace/agent-verbs/find), bound to this product's summaries and folders.
import type { DocumentSummary, Folder } from '@livediagram/api-schema';
import {
  createFind,
  type FoundFile,
  type Libraries as SharedLibraries,
} from '@liveworkspace/agent-verbs/find';
import { AGENT_PRODUCT } from './agent-product';

// Every library the caller reaches, with its folders: the personal one, then each joined team's.
export type Libraries = SharedLibraries<'documents', DocumentSummary, Folder>;

export type FoundDocument = FoundFile;

export const {
  fetchTeamLibraries,
  readLibraries,
  matchFiles: matchDocuments,
  listAllFiles: listAllDocuments,
} = createFind<DocumentSummary, Folder, 'documents'>(AGENT_PRODUCT);
