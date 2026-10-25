// The sweep of the caller's projects the MCP's find_projects and the CLI's addressing share
// (@liveworkspace/agent-verbs/find), bound to this product's summaries and folders.
import type { ProjectSummary, Folder } from '@liveplanner/api-schema';
import {
  createFind,
  type FoundFile,
  type Libraries as SharedLibraries,
} from '@liveworkspace/agent-verbs/find';
import { AGENT_PRODUCT } from './agent-product';

// Every library the caller reaches, with its folders: the personal one, then each joined team's.
export type Libraries = SharedLibraries<'projects', ProjectSummary, Folder>;

export type FoundProject = FoundFile;

export const {
  fetchTeamLibraries,
  readLibraries,
  matchFiles: matchProjects,
  listAllFiles: listAllProjects,
} = createFind<ProjectSummary, Folder, 'projects'>(AGENT_PRODUCT);
