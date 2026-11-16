// Whom an Editor may name (approvals.md "Who may be named"): the team's members first, then the owner and the people
// who came in through a whole-item link, each once, never the asker. The index checks every name again; this is the
// list the form draws.

import type { ApprovalCandidate } from '@liveworkspace/index-client';
import type { ApprovalTeamPerson } from './door';

export type Nameable = { id: string; name: string | null; via: 'team' | 'owner' | 'link' };

export const VIA_WORDS: Readonly<Record<Nameable['via'], string>> = {
  team: 'Team',
  owner: 'Owner',
  link: 'Link',
};

/** Team members first, then the index's candidates; each person once, never `self`. */
export function mergeNameable(
  team: readonly ApprovalTeamPerson[],
  candidates: readonly ApprovalCandidate[],
  self: string,
): Nameable[] {
  const seen = new Set<string>([self]);
  const out: Nameable[] = [];
  const add = (person: Nameable) => {
    if (seen.has(person.id)) return;
    seen.add(person.id);
    out.push(person);
  };
  for (const p of team) add({ id: p.id, name: p.name, via: 'team' });
  for (const p of candidates) add({ id: p.id, name: p.name, via: p.via });
  return out;
}

/** The people whose name holds every word of the filter, any case. */
export function filterNameable(people: readonly Nameable[], query: string): Nameable[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...people];
  return people.filter((p) => {
    const name = (p.name ?? '').toLowerCase();
    return words.every((w) => name.includes(w));
  });
}
