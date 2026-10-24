'use client';

// New Team, from the sidebar's Spaces group or the panel's rail: the team dialog, and the team made opens.

import { useToast } from '../ui/Toasts';
import type { TeamRef } from '../types';
import { useTeams } from './context';
import { TeamFormDialog } from './TeamFormDialog';

export function NewTeamDialog({
  onClose,
  onMade,
}: {
  onClose: () => void;
  onMade: (team: TeamRef) => void;
}) {
  const { create } = useTeams();
  const toast = useToast();
  return (
    <TeamFormDialog
      mode="create"
      onClose={onClose}
      onSubmit={async (input) => {
        const result = await create(input);
        if (result.ok) {
          onClose();
          toast.show(`${result.value.name} is ready. Invite people from its card.`, {
            tone: 'success',
          });
          onMade(result.value);
        }
        return result;
      }}
    />
  );
}
