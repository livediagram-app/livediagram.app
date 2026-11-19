'use client';

// New Team, from the sidebar's Spaces group or the panel's rail: the team dialog, and the team made opens. When
// accounts didn't answer in time, Refresh opens the team if it was made after all.

import { useToast } from '../ui/Toasts';
import type { TeamRef } from '../types';
import { useTeams } from './context';
import { recheckMadeTeam } from './RefreshTeamsButton';
import { TeamFormDialog } from './TeamFormDialog';

export function NewTeamDialog({
  onClose,
  onMade,
}: {
  onClose: () => void;
  onMade: (team: TeamRef) => void;
}) {
  const { create, findMadeTeam } = useTeams();
  const toast = useToast();
  const opened = (team: TeamRef) => {
    onClose();
    toast.show(`${team.name} is ready. Invite people from its card.`, { tone: 'success' });
    onMade(team);
  };
  return (
    <TeamFormDialog
      mode="create"
      onClose={onClose}
      onSubmit={async (input) => {
        const result = await create(input);
        if (result.ok) opened(result.value);
        return result;
      }}
      onRefresh={async (name) => {
        const team = await recheckMadeTeam(findMadeTeam, name);
        if (team.ok) opened(team.value);
        return team;
      }}
    />
  );
}
