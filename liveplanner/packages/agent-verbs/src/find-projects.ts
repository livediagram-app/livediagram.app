// The project sweep the MCP's find_projects and the CLI's addressing share (docs/specs/015-api/mcp-server.md §4.1,
// docs/specs/015-api/blueprints/cli.md "Addressing"): the caller's personal
// library PLUS every shared library of the teams they've joined. A project
// filed into a team leaves its owner's personal list entirely (docs/specs/013-workspace/team-shared-projects.md), so
// without the team sweep it would be invisible to the MCP — the personal
// GET /projects alone is not "the user's projects".
import type {
  ProjectSummary,
  Folder,
  TeamLibraryResponse,
  TeamListItem,
  TeamsResponse,
} from '@liveplanner/api-schema';
import type { ApiClient } from '@liveworkspace/api-client';

type TeamLibrary = { teamName: string; projects: ProjectSummary[] };

// Every library the caller reaches, with its folders (the folder picker): the personal one, then each joined
// team's.
export type Libraries = {
  personal: { projects: ProjectSummary[]; folders: Folder[] };
  teams: { id: string; name: string; projects: ProjectSummary[]; folders: Folder[] }[];
};

// One search hit. `library` is 'personal' or the team's name, so the
// calling model can tell the user where a project lives (and disambiguate
// same-named projects across libraries).
export type FoundProject = {
  id: string;
  name: string;
  updatedAt: number;
  library: string;
};

// Each joined team's library, projects and folders. Best-effort by design: the
// personal results must still come back when the teams surface is
// unavailable (an older api deployment, a race with a membership
// removal), so failures collapse to "no team projects", never an error.
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
        const { projects, folders } = await api.json<TeamLibraryResponse>(`/teams/${t.id}/library`);
        return { id: t.id, name: t.name, projects, folders };
      } catch {
        return { id: t.id, name: t.name, projects: [], folders: [] };
      }
    }),
  );
}

// Fetch every joined team's shared library.
export async function fetchTeamLibraries(api: ApiClient): Promise<TeamLibrary[]> {
  const teams = await readTeams(api);
  return teams.map((t) => ({ teamName: t.name, projects: t.projects }));
}

// The personal projects and folders and each joined team's, in one sweep.
export async function readLibraries(api: ApiClient): Promise<Libraries> {
  const [{ projects }, { folders }, teams] = await Promise.all([
    api.json<{ projects: ProjectSummary[] }>('/projects'),
    api.json<{ folders: Folder[] }>('/folders'),
    readTeams(api),
  ]);
  return { personal: { projects, folders }, teams };
}

// Pure merge + filter + rank: personal and team projects together,
// name-matched against the query, newest saved first, capped at `limit`.
export function matchProjects(
  personal: ProjectSummary[],
  teamLibraries: TeamLibrary[],
  query: string | undefined,
  limit: number,
): FoundProject[] {
  const q = (query ?? '').toLowerCase();
  const all: FoundProject[] = [
    ...personal.map((d) => ({ d, library: 'personal' })),
    ...teamLibraries.flatMap((lib) => lib.projects.map((d) => ({ d, library: lib.teamName }))),
  ].map(({ d, library }) => ({ id: d.id, name: d.name, updatedAt: d.savedAt, library }));
  return all
    .filter((d) => !q || d.name.toLowerCase().includes(q))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

// Every project the caller can reach: the personal library and each joined team's, newest first.
export async function listAllProjects(api: ApiClient): Promise<FoundProject[]> {
  const [{ projects }, teams] = await Promise.all([
    api.json<{ projects: ProjectSummary[] }>('/projects'),
    fetchTeamLibraries(api),
  ]);
  return matchProjects(projects, teams, undefined, Number.POSITIVE_INFINITY);
}
