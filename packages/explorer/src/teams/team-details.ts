'use client';

// What a team's view needs before its card (./TeamCard.tsx) loads: the team's members, read when it opens, its
// headline and a name's initials. Kept out of the card's module so the card, its dialogs and menus load only when a
// team view draws (liveworkspace/docs/specs/010-site/blueprints/site.md "Performance and limits").

import { useCallback, useEffect, useState } from 'react';
import { isAbort } from '../data/errors';
import type { TeamDetails } from '../data/teams';
import { useTeams } from './context';
import { memberState } from './rules';

export type TeamLoad =
  | { state: 'loading' }
  | { state: 'found'; details: TeamDetails }
  | { state: 'gone' }
  // Accounts could not be asked (no host, or it failed): the team's library still shows, without its card.
  | { state: 'unknown' };

/** A team's members, read when it opens (and on `reload`). */
export function useTeamDetails(teamId: string) {
  const { host } = useTeams();
  const [load, setLoad] = useState<{ teamId: string; load: TeamLoad }>({
    teamId,
    load: { state: host ? 'loading' : 'unknown' },
  });
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    if (!host) {
      setLoad({ teamId, load: { state: 'unknown' } });
      return;
    }
    const controller = new AbortController();
    host.team(teamId, controller.signal).then(
      (details) =>
        setLoad({ teamId, load: details ? { state: 'found', details } : { state: 'gone' } }),
      (e: unknown) => {
        if (!isAbort(e)) setLoad({ teamId, load: { state: 'unknown' } });
      },
    );
    return () => controller.abort();
  }, [host, teamId, epoch]);
  const reload = useCallback(() => setEpoch((n) => n + 1), []);
  const current: TeamLoad = load.teamId === teamId ? load.load : { state: 'loading' };
  return [current, reload] as const;
}

/** "3 members · 1 invited · You’re an admin": the headline after the organisation. */
export function teamFacts(details: TeamDetails): string[] {
  const joined = details.members.filter((m) => m.status === 'joined').length;
  const invited = details.members.filter((m) => memberState(m) === 'invited').length;
  return [
    `${joined} ${joined === 1 ? 'member' : 'members'}`,
    invited ? `${invited} invited` : null,
    details.team.myRole === 'admin' ? 'You’re an admin' : null,
  ].filter((part): part is string => part !== null);
}

/** "Northwind · 3 members · 1 invited · You’re an admin". */
export function teamHeadline(details: TeamDetails): string {
  return [details.team.organisation, ...teamFacts(details)].filter(Boolean).join(' · ');
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  // Code points, so a team named "🚀 Launch" shows its rocket, not half of it.
  const first = (word: string | undefined) => (word ? Array.from(word)[0]! : '');
  return (first(parts[0]) + (parts.length > 1 ? first(parts.at(-1)) : '')).toUpperCase() || '?';
}
