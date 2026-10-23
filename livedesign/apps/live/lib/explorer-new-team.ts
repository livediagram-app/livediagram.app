'use client';

// New Team in the Explorer's Move dialog (the shared Explorer's `onCreateTeam`): the team is made on liveworkspace
// through this app's API (`POST /api/teams`, team-create.ts), so it is the same team in every app, and the design
// is filed into it at once (the index asks accounts about a team the person's token does not name yet). Until the
// token is renewed, the made team joins the token's teams here, so the panel's rail and the dialog show it.

import { useCallback, useMemo, useState } from 'react';
import type { CreateTeam, TeamRef } from '@liveworkspace/explorer';
import { API_BASE, apiFetch, currentBearer } from './api/core';

type MadeTeam = { id: string; name: string };

/** Makes a team for the person signed in; null when refused (a guest, a name accounts turn down, no network). */
export async function createTeam(name: string): Promise<MadeTeam | null> {
  const token = await currentBearer();
  if (!token) return null;
  const res = await apiFetch(`${API_BASE}/teams`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  }).catch(() => null);
  if (!res?.ok) return null;
  const body = (await res.json().catch(() => null)) as { team?: MadeTeam } | null;
  return body?.team ? { id: body.team.id, name: body.team.name } : null;
}

/** The person's teams with any made here since, and New Team for a signed-in person (a guest has no teams). */
export function useExplorerNewTeam(
  signedIn: boolean,
  tokenTeams: TeamRef[],
): { teams: TeamRef[]; onCreateTeam: CreateTeam | undefined } {
  const [made, setMade] = useState<TeamRef[]>([]);
  const teams = useMemo(
    () =>
      made.length === 0
        ? tokenTeams
        : [...tokenTeams, ...made.filter((m) => !tokenTeams.some((t) => t.id === m.id))],
    [tokenTeams, made],
  );
  const onCreateTeam = useCallback<CreateTeam>(async (name) => {
    const team = await createTeam(name);
    if (team) setMade((was) => [...was, team]);
    return team;
  }, []);
  return { teams, onCreateTeam: signedIn ? onCreateTeam : undefined };
}
