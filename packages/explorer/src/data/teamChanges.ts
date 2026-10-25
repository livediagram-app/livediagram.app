// The teams changed here, laid over the list the token names until a renewed token (or accounts' list) says the
// same (packages/explorer/README.md "Teams"): a team made or joined shows at once, a renamed one with its new name,
// and one left or deleted goes. Kept for the page's life and shared by every Explorer on it (the page, the
// editor's panel), so a team made in one shows in the other. Bounded: a person is in at most 50 teams, and each
// change replaces the last for its team.

import type { TeamRef } from '../types';

type Changes = {
  // Made or joined here, in the order they came.
  made: readonly TeamRef[];
  gone: ReadonlySet<string>;
  renamed: ReadonlyMap<string, string>;
};

const EMPTY: Changes = { made: [], gone: new Set(), renamed: new Map() };
// Past this many changes the oldest are forgotten (well beyond the 50 teams a person can be in).
const MAX_CHANGES = 200;

let changes: Changes = EMPTY;
const listeners = new Set<() => void>();

function set(next: Changes) {
  changes = next;
  for (const listen of listeners) listen();
}

const capped = <T>(entries: T[]) => entries.slice(-MAX_CHANGES);

export const teamChanges = {
  subscribe(listen: () => void): () => void {
    listeners.add(listen);
    return () => listeners.delete(listen);
  },
  snapshot: (): Changes => changes,
  /** Made or joined: in the list from now on (and no longer gone). */
  made(team: TeamRef) {
    const gone = new Set(changes.gone);
    gone.delete(team.id);
    set({
      made: capped([...changes.made.filter((t) => t.id !== team.id), team]),
      gone,
      renamed: changes.renamed,
    });
  },
  renamed(teamId: string, name: string) {
    const renamed = new Map(changes.renamed);
    renamed.delete(teamId);
    renamed.set(teamId, name);
    set({ ...changes, renamed: new Map(capped([...renamed])) });
  },
  /** Left or deleted. */
  gone(teamId: string) {
    set({
      made: changes.made.filter((t) => t.id !== teamId),
      gone: new Set(capped([...changes.gone, teamId])),
      renamed: changes.renamed,
    });
  },
  /** For tests. */
  reset() {
    set(EMPTY);
  },
};

/** The teams to show: the known list with the changes made here laid over it. */
export function applyTeamChanges(known: readonly TeamRef[], over: Changes): TeamRef[] {
  if (over === EMPTY) return known as TeamRef[];
  const seen = new Set(known.map((t) => t.id));
  return [...known, ...over.made.filter((t) => !seen.has(t.id))]
    .filter((t) => !over.gone.has(t.id))
    .map((t) => {
      const name = over.renamed.get(t.id);
      return name && name !== t.name ? { ...t, name } : t;
    });
}
