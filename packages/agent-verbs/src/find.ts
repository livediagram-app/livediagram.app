// The sweep of the caller's files the MCP's find_<collection> and the CLI's addressing share
// (docs/specs/015-api/mcp-server.md §4.1, docs/specs/015-api/blueprints/cli.md "Addressing"): the caller's personal
// library PLUS every shared library of the teams they've joined. A file filed into a team leaves its owner's
// personal list entirely (docs/specs/013-workspace/team-shared-*.md), so without the team sweep it would be
// invisible to the MCP: the personal GET /<collection> alone is not "the user's files".
//
// The api answers each list under the product's collection (`{ documents }`, `{ designs }`), so the types are keyed
// by it; each product binds them to its summary and folder types (its find-<collection>.ts).
import type { ApiClient } from '@liveworkspace/api-client';
import type { AgentProduct } from './product';

// A file as the api lists it: the fields the sweep reads. Each product's summary type is this, and more.
export type FileSummary = { id: string; name: string; savedAt: number };

type Listed<C extends string, S> = { [K in C]: S[] };

export type TeamLibrary<C extends string, S> = { teamName: string } & Listed<C, S>;

// Every library the caller reaches, with its folders (a repository link's coverage, the folder picker): the
// personal one, then each joined team's.
export type Libraries<C extends string, S, F> = {
  personal: Listed<C, S> & { folders: F[] };
  teams: ({ id: string; name: string } & Listed<C, S> & { folders: F[] })[];
};

// One search hit. `library` is 'personal' or the team's name, so the calling model can tell the user where a file
// lives (and disambiguate same-named files across libraries).
export type FoundFile = {
  id: string;
  name: string;
  updatedAt: number;
  library: string;
};

type TeamsAnswer = { teams: { id: string; name: string }[] };

export function createFind<S extends FileSummary, F, C extends string>(
  product: Pick<AgentProduct<string, C>, 'collection'>,
) {
  const { collection } = product;
  type Team = Libraries<C, S, F>['teams'][number];
  const team = (id: string, name: string, files: S[], folders: F[]) =>
    ({ id, name, [collection]: files, folders }) as Team;
  const listOf = (answer: Listed<C, S>) => (answer as Record<string, S[]>)[collection]!;
  const readPersonal = (api: ApiClient) => api.json<Listed<C, S>>(`/${collection}`);

  // Each joined team's library, files and folders. Best-effort by design: the personal results must still come
  // back when the teams surface is unavailable (an older api, a race with a membership removal), so failures
  // collapse to "no team files", never an error.
  async function readTeams(api: ApiClient): Promise<Team[]> {
    let teams: TeamsAnswer['teams'];
    try {
      ({ teams } = await api.json<TeamsAnswer>('/teams'));
    } catch {
      return [];
    }
    return Promise.all(
      teams.map(async (t) => {
        try {
          const answer = await api.json<Listed<C, S> & { folders: F[] }>(`/teams/${t.id}/library`);
          return team(t.id, t.name, listOf(answer), answer.folders);
        } catch {
          return team(t.id, t.name, [], []);
        }
      }),
    );
  }

  // Fetch every joined team's shared library.
  async function fetchTeamLibraries(api: ApiClient): Promise<TeamLibrary<C, S>[]> {
    const teams = await readTeams(api);
    return teams.map((t) => ({ teamName: t.name, [collection]: listOf(t) }) as TeamLibrary<C, S>);
  }

  // The personal files and folders and each joined team's, in one sweep.
  async function readLibraries(api: ApiClient): Promise<Libraries<C, S, F>> {
    const [personal, { folders }, teams] = await Promise.all([
      readPersonal(api),
      api.json<{ folders: F[] }>('/folders'),
      readTeams(api),
    ]);
    return {
      personal: { [collection]: listOf(personal), folders } as Libraries<C, S, F>['personal'],
      teams,
    };
  }

  // Pure merge + filter + rank: personal and team files together, name-matched against the query, newest saved
  // first, capped at `limit`.
  function matchFiles(
    personal: S[],
    teamLibraries: TeamLibrary<C, S>[],
    query: string | undefined,
    limit: number,
  ): FoundFile[] {
    const q = (query ?? '').toLowerCase();
    const all: FoundFile[] = [
      ...personal.map((d) => ({ d, library: 'personal' })),
      ...teamLibraries.flatMap((lib) => listOf(lib).map((d) => ({ d, library: lib.teamName }))),
    ].map(({ d, library }) => ({ id: d.id, name: d.name, updatedAt: d.savedAt, library }));
    return all
      .filter((d) => !q || d.name.toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  }

  // Every file the caller can reach: the personal library and each joined team's, newest first.
  async function listAllFiles(api: ApiClient): Promise<FoundFile[]> {
    const [personal, teams] = await Promise.all([readPersonal(api), fetchTeamLibraries(api)]);
    return matchFiles(listOf(personal), teams, undefined, Number.POSITIVE_INFINITY);
  }

  return { fetchTeamLibraries, readLibraries, matchFiles, listAllFiles };
}
