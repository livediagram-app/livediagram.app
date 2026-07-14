// The find_diagrams search space (spec/62 §4.1): the caller's personal
// library PLUS every shared library of the teams they've joined. A diagram
// filed into a team leaves its owner's personal list entirely (spec/35), so
// without the team sweep it would be invisible to the MCP — the personal
// GET /diagrams alone is not "the user's diagrams".
import type { DiagramSummary, TeamListItem } from '@livediagram/api-schema';
import { apiJson } from './api';
import type { Env } from './env';

type TeamLibrary = { teamName: string; diagrams: DiagramSummary[] };

// One search hit. `library` is 'personal' or the team's name, so the
// calling model can tell the user where a diagram lives (and disambiguate
// same-named diagrams across libraries).
type FoundDiagram = {
  id: string;
  name: string;
  updatedAt: number;
  library: string;
};

// Fetch every joined team's shared library. Best-effort by design: the
// personal results must still come back when the teams surface is
// unavailable (an older self-hosted api, a race with a membership
// removal), so failures collapse to "no team diagrams", never an error.
export async function fetchTeamLibraries(env: Env, token: string): Promise<TeamLibrary[]> {
  let teams: TeamListItem[];
  try {
    ({ teams } = await apiJson<{ teams: TeamListItem[] }>(env, token, '/teams'));
  } catch {
    return [];
  }
  const libraries = await Promise.all(
    teams.map(async (t) => {
      try {
        const { diagrams } = await apiJson<{ diagrams: DiagramSummary[] }>(
          env,
          token,
          `/teams/${t.id}/library`,
        );
        return { teamName: t.name, diagrams };
      } catch {
        return { teamName: t.name, diagrams: [] };
      }
    }),
  );
  return libraries;
}

// Pure merge + filter + rank: personal and team diagrams together,
// name-matched against the query, newest saved first, capped at `limit`.
export function matchDiagrams(
  personal: DiagramSummary[],
  teamLibraries: TeamLibrary[],
  query: string | undefined,
  limit: number,
): FoundDiagram[] {
  const q = (query ?? '').toLowerCase();
  const all: FoundDiagram[] = [
    ...personal.map((d) => ({ d, library: 'personal' })),
    ...teamLibraries.flatMap((lib) => lib.diagrams.map((d) => ({ d, library: lib.teamName }))),
  ].map(({ d, library }) => ({ id: d.id, name: d.name, updatedAt: d.savedAt, library }));
  return all
    .filter((d) => !q || d.name.toLowerCase().includes(q))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}
