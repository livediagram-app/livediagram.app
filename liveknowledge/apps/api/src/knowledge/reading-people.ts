// Who a Required Reading page is for (docs/specs/030-knowledgebase/required-reading.md "What it is"; blueprint
// "Behaviour and state"): the chosen people, or for Everyone the team's joined members, the knowledgebase's owner and
// everyone who confirmed, once each. The team is read through the platform and kept a minute a team in memory, so a
// page many people open in a minute reads it once.
import { isAccountId } from '@liveworkspace/auth-client';
import type { TeamPerson } from '@liveworkspace/auth-client';
import { presenceColourOf } from '@liveworkspace/settings/presence';
import { getParticipants } from '../person/profiles';
import { teamPeople } from '../person/notify';
import type { DocumentDTO, DocumentEnv } from '../types';
import type { Requirement } from './page-reading';

/** How long a team's members are kept (ms). Safe range 10 s to 5 min: a new member waits at most this long. */
export const TEAM_CACHE_MS = 60_000;
/** At most this many teams kept. */
export const TEAM_CACHE_MAX = 100;

const teams = new Map<string, { at: number; people: TeamPerson[] | null }>();

/** For tests: forget the teams kept. */
export function __forgetReadingTeams(): void {
  teams.clear();
}

async function teamOf(env: DocumentEnv, teamId: string, now: number) {
  const held = teams.get(teamId);
  if (held && held.at > now - TEAM_CACHE_MS) return held.people;
  const people = await teamPeople(env, teamId);
  if (teams.size >= TEAM_CACHE_MAX) teams.delete(teams.keys().next().value!);
  teams.set(teamId, { at: now, people });
  return people;
}

export type Audience = {
  /** Everyone counted, in a stable order: the chosen as chosen; for Everyone the team, the owner, then confirmers. */
  ids: string[];
  /** The names the team gave, by id. */
  names: Map<string, string>;
  /** Each named team member's presence colour (their own, else the one Automatic picks from the name), by id. */
  colors: Map<string, string>;
};

/** The page's audience list. `confirmers` count for Everyone; for Chosen People only the chosen count. */
export async function audienceOf(
  env: DocumentEnv,
  document: Pick<DocumentDTO, 'ownerId' | 'teamId'>,
  requirement: Requirement,
  confirmers: Iterable<string>,
  now: number,
): Promise<Audience> {
  const names = new Map<string, string>();
  const colors = new Map<string, string>();
  if (requirement.audience === 'people') return { ids: [...requirement.people], names, colors };
  const seen = new Set<string>();
  const ids: string[] = [];
  const add = (id: string | null | undefined) => {
    if (!id || !isAccountId(id) || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };
  const team = document.teamId ? await teamOf(env, document.teamId, now) : null;
  for (const person of team ?? []) {
    if (person.status !== 'joined' || !person.userId) continue;
    add(person.userId);
    if (person.name) {
      names.set(person.userId, person.name);
      colors.set(person.userId, presenceColourOf(person.name, person.color));
    }
  }
  add(document.ownerId);
  for (const id of confirmers) add(id);
  return { ids, names, colors };
}

/** Each id's name and presence colour: the team's, else its profile's from one read, else "Someone" with no colour
 *  (the editor draws the name's Automatic one). */
export async function namesOf(
  env: DocumentEnv,
  ids: readonly string[],
  known: Pick<Audience, 'names' | 'colors'>,
): Promise<Map<string, { name: string; color?: string }>> {
  const missing = ids.filter((id) => !known.names.has(id));
  const profiles: ReadonlyMap<string, { name?: string | null; color?: string }> =
    missing.length > 0 ? await getParticipants(env, missing) : new Map();
  const out = new Map<string, { name: string; color?: string }>();
  for (const id of ids) {
    const profile = profiles.get(id);
    const name = known.names.get(id) ?? profile?.name;
    const color = known.colors.get(id) ?? profile?.color;
    const named = typeof name === 'string' && name.trim() ? name.trim() : 'Someone';
    out.set(id, color ? { name: named, color } : { name: named });
  }
  return out;
}
