// Response envelopes: the `{ <noun>: payload }` wrappers the api worker puts
// around the canonical types in ./index.ts. Named once here so every consumer
// of the wire (the live editor's api client, the MCP server's tools) reads
// the same shape instead of spelling `{ project: Project }` inline at each
// call site, where a renamed key would drift silently.

import type { Project, ProjectSummary, Folder, ShareLink, TabRecord, TeamListItem } from './index';
import type { TeamRecentProject } from './recent-diagrams';

// GET / PUT /api/projects/:id, POST /api/projects (+ copy).
export type ProjectResponse = { project: Project };
// GET /api/projects/:id/tabs/:tabId.
export type TabResponse = { tab: TabRecord };
// GET /api/projects: the caller's personal library. With `?include=team-recent` it also carries the
// newest projects of the teams they have joined (docs/specs/019-marketing/returning-visitor.md).
export type ProjectListResponse = {
  projects: ProjectSummary[];
  teamRecent?: TeamRecentProject[];
};
// POST /api/projects/:id/share (+ extend).
export type ShareLinkResponse = { link: ShareLink };
// GET /api/teams: the teams the caller belongs to (docs/specs/013-workspace/teams.md).
export type TeamsResponse = { teams: TeamListItem[] };
// GET /api/teams/:id/library: a team's shared folders + projects (docs/specs/013-workspace/team-shared-projects.md).
export type TeamLibraryResponse = { folders: Folder[]; projects: ProjectSummary[] };
