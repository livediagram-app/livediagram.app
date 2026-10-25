// The design sweep the MCP's find_designs and the CLI's addressing share (docs/specs/015-api/mcp-server.md §4.1,
// docs/specs/015-api/blueprints/cli.md "Addressing"): the caller's personal
// library PLUS every shared library of the teams they've joined. A design
// filed into a team leaves its owner's personal list entirely (docs/specs/013-workspace/team-shared-designs.md), so
// without the team sweep it would be invisible to the MCP — the personal
// GET /designs alone is not "the user's designs".
import type {
  DesignSummary,
  Folder,
  TeamLibraryResponse,
  TeamListItem,
  TeamsResponse,
} from '@livedesign/api-schema';
import type { ApiClient } from '@liveworkspace/api-client';

type TeamLibrary = { teamName: string; designs: DesignSummary[] };

// Every library the caller reaches, with its folders (the folder picker): the personal one, then each joined
// team's.
export type Libraries = {
  personal: { designs: DesignSummary[]; folders: Folder[] };
  teams: { id: string; name: string; designs: DesignSummary[]; folders: Folder[] }[];
};

// One search hit. `library` is 'personal' or the team's name, so the
// calling model can tell the user where a design lives (and disambiguate
// same-named designs across libraries).
export type FoundDesign = {
  id: string;
  name: string;
  updatedAt: number;
  library: string;
};

// Each joined team's library, designs and folders. Best-effort by design: the
// personal results must still come back when the teams surface is
// unavailable (an older api, a race with a membership
// removal), so failures collapse to "no team designs", never an error.
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
        const { designs, folders } = await api.json<TeamLibraryResponse>(
          `/teams/${t.id}/library`,
        );
        return { id: t.id, name: t.name, designs, folders };
      } catch {
        return { id: t.id, name: t.name, designs: [], folders: [] };
      }
    }),
  );
}

// Fetch every joined team's shared library.
export async function fetchTeamLibraries(api: ApiClient): Promise<TeamLibrary[]> {
  const teams = await readTeams(api);
  return teams.map((t) => ({ teamName: t.name, designs: t.designs }));
}

// The personal designs and folders and each joined team's, in one sweep.
export async function readLibraries(api: ApiClient): Promise<Libraries> {
  const [{ designs }, { folders }, teams] = await Promise.all([
    api.json<{ designs: DesignSummary[] }>('/designs'),
    api.json<{ folders: Folder[] }>('/folders'),
    readTeams(api),
  ]);
  return { personal: { designs, folders }, teams };
}

// Pure merge + filter + rank: personal and team designs together,
// name-matched against the query, newest saved first, capped at `limit`.
export function matchDesigns(
  personal: DesignSummary[],
  teamLibraries: TeamLibrary[],
  query: string | undefined,
  limit: number,
): FoundDesign[] {
  const q = (query ?? '').toLowerCase();
  const all: FoundDesign[] = [
    ...personal.map((d) => ({ d, library: 'personal' })),
    ...teamLibraries.flatMap((lib) => lib.designs.map((d) => ({ d, library: lib.teamName }))),
  ].map(({ d, library }) => ({ id: d.id, name: d.name, updatedAt: d.savedAt, library }));
  return all
    .filter((d) => !q || d.name.toLowerCase().includes(q))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

// Every design the caller can reach: the personal library and each joined team's, newest first.
export async function listAllDesigns(api: ApiClient): Promise<FoundDesign[]> {
  const [{ designs }, teams] = await Promise.all([
    api.json<{ designs: DesignSummary[] }>('/designs'),
    fetchTeamLibraries(api),
  ]);
  return matchDesigns(designs, teams, undefined, Number.POSITIVE_INFINITY);
}
