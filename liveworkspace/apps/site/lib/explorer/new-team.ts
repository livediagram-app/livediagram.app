'use client';

// New Team in the Explorer's Move dialog (@liveworkspace/explorer's onCreateTeam), as livediagram's Move dialog has
// it. On liveworkspace.app the team is made through the account API (this origin's /api/account/teams, as Manage
// Teams makes one). On an app's own address (page-app.ts) the page holds the app's token, which accounts doesn't take
// for making a team, so the app's own API makes it (the registry's `teamsPath`): it checks the person's token and
// vouches for them to liveworkspace, exactly as the app's editor does from its Move dialog. Either way the token is
// read again, so it names the new team before the item is filed into it.

import { APP_ITEMS, type AppName } from '@liveworkspace/sites';
import { accountApi, type MyTeam } from '@/lib/account-api';
import { forgetAppAccount } from './app-session';
import { pageApp } from './page-app';
import {
  resetWorkspaceIdentity,
  workspaceIdentity,
  workspaceToken,
  type WorkspaceIdentity,
} from './token';

export type MadeTeam = { team: { id: string; name: string }; identity: WorkspaceIdentity | null };

type Made = { id: string; name: string };

/** Whether New Team can be offered where the page is: always on liveworkspace.app, on an app's address only where
 *  the app's API makes teams. */
export function canMakeTeam(host: AppName | null): boolean {
  return host === null || APP_ITEMS[host].teamsPath !== null;
}

async function makeOnApp(path: string, name: string): Promise<Made | null> {
  const token = await workspaceToken();
  if (!token) return null;
  try {
    const res = await fetch(path, {
      method: 'POST',
      credentials: 'omit',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { team?: { id?: unknown; name?: unknown } };
    const team = body.team;
    return typeof team?.id === 'string' && typeof team.name === 'string'
      ? { id: team.id, name: team.name }
      : null;
  } catch {
    return null;
  }
}

async function makeOnWorkspace(name: string): Promise<Made | null> {
  const result = await accountApi<MyTeam>('/teams', 'POST', { name });
  return result.ok ? { id: result.data.id, name: result.data.name } : null;
}

/** Makes the team and renews the token; null when it is refused (or can't be made here). */
export async function makeTeam(name: string): Promise<MadeTeam | null> {
  const host = pageApp();
  const path = host ? APP_ITEMS[host].teamsPath : null;
  if (host && !path) return null;
  const made = path ? await makeOnApp(path, name) : await makeOnWorkspace(name);
  if (!made) return null;
  if (host) forgetAppAccount();
  resetWorkspaceIdentity();
  const identity = await workspaceIdentity();
  return { team: made, identity };
}
