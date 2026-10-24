// Response envelopes: the `{ <noun>: payload }` wrappers the api worker puts
// around the canonical types in ./index.ts. Named once here so every consumer
// of the wire (the live editor's api client, the MCP server's tools) reads
// the same shape instead of spelling `{ design: LiveDoc }` inline at each
// call site, where a renamed key would drift silently.

import type { LiveDoc, DesignSummary, Folder, ShareLink, TabRecord, TeamListItem } from './index';

// GET / PUT /api/designs/:id, POST /api/designs (+ copy).
export type DesignResponse = { design: LiveDoc };
// GET /api/designs/:id/tabs/:tabId.
export type TabResponse = { tab: TabRecord };
// GET /api/designs: the caller's personal library.
export type DesignListResponse = { designs: DesignSummary[] };
// POST /api/designs/:id/share (+ extend).
export type ShareLinkResponse = { link: ShareLink };
// GET /api/teams: the teams the caller belongs to (docs/specs/013-workspace/teams.md).
export type TeamsResponse = { teams: TeamListItem[] };
// GET /api/teams/:id/library: a team's shared folders + designs (docs/specs/013-workspace/team-shared-designs.md).
export type TeamLibraryResponse = { folders: Folder[]; designs: DesignSummary[] };
