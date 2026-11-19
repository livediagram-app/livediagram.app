'use client';

// Refresh, said after "The team may have been made. Refresh to check." (liveworkspace/docs/specs/003-accounts/accounts.md
// "When the accounts site doesn't answer"): New Team got no answer in time, so rather than try again, which could
// make a second team, the person checks whether it was made. The New Team dialog and the Move dialog's New Team share it.

import { Button } from '@liveworkspace/ui';
import type { TeamRef } from '../types';
import { TEAM_CREATE_UNCONFIRMED, type TeamResult } from '../data/teams';

/** New Team in the Move dialog: the team made, or the refusal's code (null for one without). */
export type CreateTeam = (name: string) => Promise<TeamRef | { error: string } | null>;
/** The team named so that was made after all, or null for none (the teams context's `findMadeTeam`). */
export type FindTeam = (name: string) => Promise<TeamRef | null>;

/** Refresh's answer: the team, `team_not_made` when there is none, or still unconfirmed when the list can't be read. */
export async function recheckMadeTeam(find: FindTeam, name: string): Promise<TeamResult<TeamRef>> {
  let team: TeamRef | null;
  try {
    team = await find(name);
  } catch {
    return { ok: false, error: TEAM_CREATE_UNCONFIRMED };
  }
  return team ? { ok: true, value: team } : { ok: false, error: 'team_not_made' };
}

/** A link-weight action inside the error line, so it reads as part of the sentence it answers. */
export function RefreshTeamsButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <Button
      variant="none"
      busy={busy}
      onClick={onClick}
      className="cursor-pointer rounded-sm font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 dark:text-brand-300 dark:hover:text-brand-200"
    >
      {busy ? 'Refreshing…' : 'Refresh'}
    </Button>
  );
}
