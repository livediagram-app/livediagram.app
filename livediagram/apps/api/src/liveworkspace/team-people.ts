// A team's people as the liveworkspace accounts Worker keeps them (liveworkspace/docs/accounts.md "Teams"):
// livediagram keeps no copy. Whom a mention or an assignment may reach, and whose images a team canvas serves
// (db/image-grants.ts). Never throws: without the accounts Worker, or when it can't be reached, there is nobody
// (and it logs).

import { readTeamPeople, type TeamPerson } from '@liveworkspace/auth-client';
import { accountCredentials } from '../auth/accounts';
import type { Env } from '../types';

export type { TeamPerson };

// A team's joined and invited people, or null for no such team (or no accounts Worker).
export async function teamPeople(env: Env, teamId: string): Promise<TeamPerson[] | null> {
  const credentials = accountCredentials(env);
  if (!credentials) return null;
  try {
    return (await readTeamPeople(credentials, teamId))?.members ?? null;
  } catch (error) {
    console.warn('[teams] people_failed', { error: String(error) });
    return null;
  }
}

// A team's joined accounts.
export async function joinedMembers(env: Env, teamId: string): Promise<string[]> {
  return ((await teamPeople(env, teamId)) ?? [])
    .filter((p) => p.status === 'joined' && p.userId)
    .map((p) => p.userId as string);
}
