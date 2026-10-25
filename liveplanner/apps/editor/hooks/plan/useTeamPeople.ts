'use client';

// Who a card can be assigned to (docs/specs/026-plan/items.md "Who may do what"): the joined members of the teams
// you are part of (the teams your token names, liveworkspace/docs/accounts.md "Teams"; their people from the api,
// which reads them from liveworkspace). Named as items name people (hashed ids, docs/specs/026-plan/blueprints/
// item-store.md "Security and trust"), so the person picked is the one the api signs their writes as. Fetched
// once a plan has Plan content (docs/specs/026-plan/plan-mode.md "Cost"), and only when signed in: a guest has no
// teams. One request per team, together; the same requests the assignee picker and mention list share.
import { useEffect, useState } from 'react';
import { itemPersonId, type ItemPerson } from '@liveplanner/items';
import type { TeamMember } from '@liveplanner/api-schema';
import { apiTeamMembers } from '@/lib/api-client';
import { colorForKey } from '@/lib/identity';

// A member as an assignee: their name, else their address's local part.
export async function teamMemberPerson(member: TeamMember): Promise<ItemPerson | null> {
  if (member.status !== 'joined' || !member.userId) return null;
  const name = member.name ?? member.email?.split('@')[0] ?? null;
  if (!name) return null;
  return { id: await itemPersonId(member.userId), name, color: colorForKey(member.userId) };
}

const NO_PEOPLE: readonly ItemPerson[] = [];

export function useTeamPeople(
  ownerId: string,
  enabled: boolean,
  signedIn: boolean,
  teams: readonly { id: string }[] = [],
): readonly ItemPerson[] {
  const [people, setPeople] = useState<readonly ItemPerson[]>(NO_PEOPLE);
  const teamKey = teams.map((t) => t.id).join(',');
  useEffect(() => {
    if (!enabled || !signedIn || !ownerId || !teamKey) return;
    let live = true;
    void (async () => {
      try {
        const lists = await Promise.all(teamKey.split(',').map((id) => apiTeamMembers(ownerId, id)));
        const byId = new Map<string, ItemPerson>();
        for (const members of lists)
          for (const m of members) {
            const p = await teamMemberPerson(m);
            if (p && !byId.has(p.id)) byId.set(p.id, p);
          }
        if (live) setPeople([...byId.values()]);
      } catch (err) {
        // A failure leaves the list as it was.
        console.warn('[plan] plan.team-people.load-failed', { error: String(err) });
      }
    })();
    return () => {
      live = false;
    };
  }, [ownerId, enabled, signedIn, teamKey]);
  return signedIn && enabled ? people : NO_PEOPLE;
}
