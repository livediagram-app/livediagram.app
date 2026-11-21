'use client';

// The kit's `useItem` (blueprint automations.md "Editor", "The item"): the open Space the host provides, with the
// people of the team it is filed in beside the signed-in account, so Who Did It and Send Email to a person can name
// them. livehuddle loads no team on the editor's load (it has no comment mentions to load it for), so the screen
// reads it here, once each time it opens, and only for a Space filed in a team the account's token names. A failed
// read leaves the account alone, and the rule still saves. Loaded with the screen alone (space-kit.tsx).

import { use, useEffect, useMemo, useState } from 'react';
import { teamMemberRows } from '@liveworkspace/workbench/hooks/collab/team-member-rows';
import type { ItemView } from '@liveworkspace/automations-ui/item';
import { apiTeamMembers } from '@/lib/api/team-people';
import { SpaceItemContext, peopleOf, type SpaceTeam } from './space-item';

type Member = { userId: string | null; name: string; pending?: boolean };

const NONE: readonly Member[] = [];

/** The team's people, joined and invited, but the caller; none until read, none for no team or a failed read. */
export function useTeamPeople(team: SpaceTeam | null): readonly Member[] {
  const key = team ? `${team.ownerId} ${team.team.id}` : null;
  const [loaded, setLoaded] = useState<{ key: string; list: readonly Member[] } | null>(null);
  useEffect(() => {
    if (!team || !key) return;
    let cancelled = false;
    void apiTeamMembers(team.ownerId, team.team.id)
      .then((members) => teamMemberRows(members, team.team, team.ownerId))
      .catch((): Member[] => [])
      .then((list) => {
        if (!cancelled) setLoaded({ key, list });
      });
    return () => {
      cancelled = true;
    };
  }, [key, team]);
  return loaded && loaded.key === key ? loaded.list : NONE;
}

// An empty view, for a screen drawn with no Space (never, as the host draws it only with a scope).
const NO_SPACE: ItemView = {
  id: '',
  name: '',
  tabs: [],
  currentTabId: null,
  people: [],
  shareCode: null,
  signedIn: false,
  openTab: () => {},
};

const sameNames = (a: readonly { id: string; name: string }[], b: typeof a) =>
  a.length === b.length && a.every((p, i) => p.id === b[i]!.id && p.name === b[i]!.name);

/** The open Space with its team's people: the host's view itself until the team adds someone, and the same object
 *  while neither changes. */
export function useSpaceItem(): ItemView {
  const { view, team } = use(SpaceItemContext);
  const members = useTeamPeople(team);
  return useMemo(() => {
    if (!view) return NO_SPACE;
    const self = view.people[0] ?? null;
    const people = peopleOf(self, members);
    return sameNames(people, view.people) ? view : { ...view, people };
  }, [view, members]);
}
