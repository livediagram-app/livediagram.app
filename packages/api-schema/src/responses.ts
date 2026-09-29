// Response envelopes: the `{ <noun>: payload }` wrappers the api worker puts
// around the canonical types in ./index.ts. Named once here so every consumer
// of the wire (the live editor's api client, the MCP server's tools) reads
// the same shape instead of spelling `{ diagram: Diagram }` inline at each
// call site, where a renamed key would drift silently.

import type { LiveDoc, DocumentSummary, Folder, ShareLink, TabRecord, TeamListItem } from './index';

// GET / PUT /api/documents/:id, POST /api/documents (+ copy).
export type DocumentResponse = { document: LiveDoc };
// GET /api/documents/:id/tabs/:tabId.
export type TabResponse = { tab: TabRecord };
// GET /api/documents: the caller's personal library.
export type DocumentListResponse = { documents: DocumentSummary[] };
// POST /api/documents/:id/share (+ extend).
export type ShareLinkResponse = { link: ShareLink };
// GET /api/teams: the teams the caller belongs to (docs/specs/013-workspace/teams.md).
export type TeamsResponse = { teams: TeamListItem[] };
// GET /api/teams/:id/library: a team's shared folders + diagrams (docs/specs/013-workspace/team-shared-documents.md).
export type TeamLibraryResponse = { folders: Folder[]; documents: DocumentSummary[] };
