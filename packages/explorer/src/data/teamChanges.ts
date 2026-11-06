// The teams changed here, laid over the list the token names until a renewed token (or accounts' list) says the
// same (packages/explorer/README.md "Teams"): a team made or joined shows at once, a renamed one with its new name,
// and one left or deleted goes. Kept for the page's life and shared by every Explorer on it (the page, the
// editor's panel), so a team made in one shows in the other. Bounded: a person is in at most 50 teams, and each
// change replaces the last for its team. A team left here goes until a read of accounts' list that started after
// the leave lists it again (`listed`): the person was added back elsewhere.

import type { TeamRef } from '../types';

type Changes = {
  // Made or joined here, in the order they came.
  made: readonly TeamRef[];
  // Left or deleted, each with when (`stamp`), so only a later read of accounts' list can bring it back.
  gone: ReadonlyMap<string, number>;
  renamed: ReadonlyMap<string, string>;
};

const EMPTY: Changes = { made: [], gone: new Map(), renamed: new Map() };
// Past this many changes the oldest are forgotten (well beyond the 50 teams a person can be in).
const MAX_CHANGES = 200;

let changes: Changes = EMPTY;
// Orders leaves against reads of accounts' list.
let clock = 0;
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
    const gone = new Map(changes.gone);
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
    const gone = new Map(changes.gone);
    gone.delete(teamId);
    gone.set(teamId, ++clock);
    set({
      made: changes.made.filter((t) => t.id !== teamId),
      gone: new Map(capped([...gone])),
      renamed: changes.renamed,
    });
  },
  /** A read of accounts' list's start, for `listed`: take it before asking. */
  stamp: (): number => ++clock,
  /** What a read that started at `startedAt` listed: a team left before it and listed again was added back
   *  elsewhere, so it shows again. A read already out when the person left can't bring it back. */
  listed(teamIds: readonly string[], startedAt: number) {
    const back = teamIds.filter((id) => (changes.gone.get(id) ?? Infinity) < startedAt);
    if (back.length === 0) return;
    const gone = new Map(changes.gone);
    for (const id of back) gone.delete(id);
    set({ ...changes, gone });
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
