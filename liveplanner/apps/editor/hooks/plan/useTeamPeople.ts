'use client';

// Who a card can be assigned to (docs/specs/026-plan/items.md "Who may do what"): the joined members of the plan's
// team, the team whose library holds it, when your token names that team (liveworkspace/docs/specs/003-accounts/
// accounts.md "Teams"; its people from the api, which reads them from liveworkspace). Never your other teams: a plan
// in My Work, This Browser or shared from someone's My Work has no team, so nobody is asked for. Named as items
// name people (hashed ids, docs/specs/026-plan/blueprints/item-store.md "Security and trust"), so the person picked
// is the one the api signs their writes as. Fetched once a plan has Plan content (docs/specs/026-plan/plan-mode.md
// "Cost"), and only when signed in: a guest has no teams. The mention list (useCommentMentions) reads the same team.
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
  teams: readonly { id: string }[],
  projectTeamId: string | null,
): readonly ItemPerson[] {
  const [people, setPeople] = useState<{ teamId: string; list: readonly ItemPerson[] } | null>(
    null,
  );
  // The plan's team, only when the token names it (a team you have left reads nobody).
  const teamId = projectTeamId && teams.some((t) => t.id === projectTeamId) ? projectTeamId : null;
  useEffect(() => {
    if (!enabled || !signedIn || !ownerId || !teamId) return;
    let live = true;
    void (async () => {
      try {
        const members = await apiTeamMembers(ownerId, teamId);
        const byId = new Map<string, ItemPerson>();
        for (const m of members) {
          const p = await teamMemberPerson(m);
          if (p && !byId.has(p.id)) byId.set(p.id, p);
        }
        if (live) setPeople({ teamId, list: [...byId.values()] });
      } catch (err) {
        // A failure leaves the list as it was.
        console.warn('[plan] plan.team-people.load-failed', { error: String(err) });
      }
    })();
    return () => {
      live = false;
    };
  }, [ownerId, enabled, signedIn, teamId]);
  // A list loaded for another team (the plan moved out of it) is never shown.
  return signedIn && enabled && teamId && people?.teamId === teamId ? people.list : NO_PEOPLE;
}
