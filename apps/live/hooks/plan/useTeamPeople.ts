'use client';

// Who a card can be assigned to (docs/specs/026-plan/items.md "Who may do what"): the joined members of the
// teams you are part of. Named as items name people (hashed ids, docs/specs/026-plan/blueprints/
// item-store.md "Security and trust"), so the person picked is the one the api signs their writes as.
// Fetched once a document has Plan content (docs/specs/026-plan/plan-mode.md "Cost"), and only when signed in:
// a guest has no teams, so asking would only earn a 401 the browser logs on every load.
import { useEffect, useState } from 'react';
import { itemPersonId, type ItemPerson } from '@livediagram/items';
import type { TeamMember } from '@livediagram/api-schema';
import { apiGetTeam, apiListTeams } from '@/lib/api/teams';
import { colorForKey } from '@/lib/identity';

// A member as an assignee: their name, else their invite address's local part.
export async function teamMemberPerson(member: TeamMember): Promise<ItemPerson | null> {
  if (member.status !== 'joined' || !member.userId) return null;
  const name = member.name ?? member.email?.split('@')[0] ?? null;
  if (!name) return null;
  return { id: await itemPersonId(member.userId), name, color: colorForKey(member.userId) };
}

export function useTeamPeople(
  ownerId: string,
  enabled: boolean,
  signedIn: boolean,
): readonly ItemPerson[] {
  const [people, setPeople] = useState<readonly ItemPerson[]>([]);
  useEffect(() => {
    if (!enabled || !signedIn || !ownerId) return;
    let live = true;
    void (async () => {
      try {
        const teams = await apiListTeams(ownerId);
        const details = await Promise.all(teams.map((t) => apiGetTeam(ownerId, t.id)));
        const byId = new Map<string, ItemPerson>();
        for (const d of details)
          for (const m of d.members) {
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
  }, [ownerId, enabled, signedIn]);
  return people;
}
