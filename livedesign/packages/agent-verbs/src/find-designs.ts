// The sweep of the caller's designs the MCP's find_designs and the CLI's addressing share
// (@liveworkspace/agent-verbs/find), bound to this product's summaries and folders.
import type { DesignSummary, Folder } from '@livedesign/api-schema';
import {
  createFind,
  type FoundFile,
  type Libraries as SharedLibraries,
} from '@liveworkspace/agent-verbs/find';
import { AGENT_PRODUCT } from './agent-product';

// Every library the caller reaches, with its folders: the personal one, then each joined team's.
export type Libraries = SharedLibraries<'designs', DesignSummary, Folder>;

export type FoundDesign = FoundFile;

export const {
  fetchTeamLibraries,
  readLibraries,
  matchFiles: matchDesigns,
  listAllFiles: listAllDesigns,
} = createFind<DesignSummary, Folder, 'designs'>(AGENT_PRODUCT);
