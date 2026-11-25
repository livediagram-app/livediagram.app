'use client';

// New Team from the pricing page's Pro for Teams card (subscription.md "The pricing page"): the Explorer's own team
// dialog over this origin's account API. Made, the token is read again so the subscription service sees the new
// team, and the card picks it, ready to subscribe. Loaded only when Create a Team is pressed.

import {
  createTeamsHost,
  recheckMadeTeam,
  TeamFormDialog,
  type TeamRef,
} from '@liveworkspace/explorer/new-team';
import { accountFetch } from '@/lib/explorer/token';
import { renewIdentity } from '@/lib/explorer/new-team';

const teams = createTeamsHost({ fetch: accountFetch });

export default function PricingNewTeam({
  onClose,
  onMade,
}: {
  onClose: () => void;
  onMade: (team: TeamRef) => void | Promise<void>;
}) {
  const made = async (team: TeamRef) => {
    await renewIdentity();
    await onMade(team);
    onClose();
  };
  return (
    <TeamFormDialog
      mode="create"
      onClose={onClose}
      onSubmit={async (input) => {
        const result = await teams.create(input);
        if (result.ok) await made(result.value);
        return result;
      }}
      onRefresh={async (name) => {
        const team = await recheckMadeTeam(async (wanted) => {
          const mine = await teams.myTeams();
          const found = mine.teams.find((candidate) => candidate.name === wanted);
          return found ? { id: found.id, name: found.name } : null;
        }, name);
        if (team.ok) await made(team.value);
        return team;
      }}
    />
  );
}
