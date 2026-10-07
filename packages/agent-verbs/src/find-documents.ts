// The document sweep the MCP's find_documents and the CLI's addressing share (docs/specs/015-api/mcp-server.md §4.1,
// docs/specs/015-api/blueprints/cli.md "Addressing"): the caller's personal
// library PLUS every shared library of the teams they've joined. A document
// filed into a team leaves its owner's personal list entirely (docs/specs/013-workspace/team-shared-documents.md), so
// without the team sweep it would be invisible to the MCP — the personal
// GET /documents alone is not "the user's documents".
import type {
  DocumentSummary,
  Folder,
  TeamLibraryResponse,
  TeamListItem,
  TeamsResponse,
} from '@livediagram/api-schema';
import type { ApiClient } from '@livediagram/api-client';

export type TeamLibrary = { teamName: string; documents: DocumentSummary[] };

// Every library the caller reaches, with its folders (the repository link's coverage and folder picker):
// the personal one, then each joined team's.
export type Libraries = {
  personal: { documents: DocumentSummary[]; folders: Folder[] };
  teams: { id: string; name: string; documents: DocumentSummary[]; folders: Folder[] }[];
};

// One search hit. `library` is 'personal' or the team's name, so the
// calling model can tell the user where a document lives (and disambiguate
// same-named documents across libraries).
export type FoundDocument = {
  id: string;
  name: string;
  updatedAt: number;
  library: string;
};

// Each joined team's library, documents and folders. Best-effort by design: the
// personal results must still come back when the teams surface is
// unavailable (an older self-hosted api, a race with a membership
// removal), so failures collapse to "no team documents", never an error.
async function readTeams(api: ApiClient): Promise<Libraries['teams']> {
  let teams: TeamListItem[];
  try {
    ({ teams } = await api.json<TeamsResponse>('/teams'));
  } catch {
    return [];
  }
  return Promise.all(
    teams.map(async (t) => {
      try {
        const { documents, folders } = await api.json<TeamLibraryResponse>(
          `/teams/${t.id}/library`,
        );
        return { id: t.id, name: t.name, documents, folders };
      } catch {
        return { id: t.id, name: t.name, documents: [], folders: [] };
      }
    }),
  );
}

// Fetch every joined team's shared library.
export async function fetchTeamLibraries(api: ApiClient): Promise<TeamLibrary[]> {
  const teams = await readTeams(api);
  return teams.map((t) => ({ teamName: t.name, documents: t.documents }));
}

// The personal documents and folders and each joined team's, in one sweep.
export async function readLibraries(api: ApiClient): Promise<Libraries> {
  const [{ documents }, { folders }, teams] = await Promise.all([
    api.json<{ documents: DocumentSummary[] }>('/documents'),
    api.json<{ folders: Folder[] }>('/folders'),
    readTeams(api),
  ]);
  return { personal: { documents, folders }, teams };
}

// Pure merge + filter + rank: personal and team documents together,
// name-matched against the query, newest saved first, capped at `limit`.
export function matchDocuments(
  personal: DocumentSummary[],
  teamLibraries: TeamLibrary[],
  query: string | undefined,
  limit: number,
): FoundDocument[] {
  const q = (query ?? '').toLowerCase();
  const all: FoundDocument[] = [
    ...personal.map((d) => ({ d, library: 'personal' })),
    ...teamLibraries.flatMap((lib) => lib.documents.map((d) => ({ d, library: lib.teamName }))),
  ].map(({ d, library }) => ({ id: d.id, name: d.name, updatedAt: d.savedAt, library }));
  return all
    .filter((d) => !q || d.name.toLowerCase().includes(q))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

// Every document the caller can reach: the personal library and each joined team's, newest first.
export async function listAllDocuments(api: ApiClient): Promise<FoundDocument[]> {
  const [{ documents }, teams] = await Promise.all([
    api.json<{ documents: DocumentSummary[] }>('/documents'),
    fetchTeamLibraries(api),
  ]);
  return matchDocuments(documents, teams, undefined, Number.POSITIVE_INFINITY);
}
