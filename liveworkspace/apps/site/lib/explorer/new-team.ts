'use client';

// New Team in the Explorer's Move dialog (@liveworkspace/explorer's onCreateTeam), as livediagram's Move dialog has
// it: the team is made on liveworkspace through the account API (this origin's /api/account/teams, as Manage Teams
// makes one), and the workspace token is read again so it names the new team before the item is filed into it.

import { accountApi, type MyTeam } from '@/lib/account-api';
import { resetWorkspaceIdentity, workspaceIdentity, type WorkspaceIdentity } from './token';

export type MadeTeam = { team: { id: string; name: string }; identity: WorkspaceIdentity | null };

/** Makes the team and renews the token; null when accounts refuse it. */
export async function makeTeam(name: string): Promise<MadeTeam | null> {
  const result = await accountApi<MyTeam>('/teams', 'POST', { name });
  if (!result.ok) return null;
  resetWorkspaceIdentity();
  const identity = await workspaceIdentity();
  return { team: { id: result.data.id, name: result.data.name }, identity };
}
