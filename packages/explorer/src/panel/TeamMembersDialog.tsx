'use client';

import { useExplorer } from '../explorer/context';
import { TeamIcon } from '../ui/icons';
import { TeamCard, useTeamDetails } from '../teams/TeamCard';
import { Dialog, DialogCloseButton, DialogHeader } from '../ui/Dialog';
import { PaneEmpty, PaneSkeleton } from './pane-parts';

// ---- A team's Members dialog ---------------------------------------------------------------------------

// The team card, as the page shows it over the team's library: read when the dialog opens. Leaving or deleting the
// team closes it and goes Home.
/** After leaving or deleting a team from its Members dialog, the dialog and the team's pane are gone: the keyboard
 *  lands on the rail's Home, where the panel now is, once the dialog has closed and handed focus back. */
export function landOnPanelHome(): void {
  setTimeout(() => {
    const entries = document.querySelectorAll<HTMLElement>(
      '[data-explorer-panel] [data-rail-entry]',
    );
    const home = [...entries].find((e) => /^Home( \(|$)/.test(e.getAttribute('aria-label') ?? ''));
    home?.focus({ preventScroll: true });
  }, 0);
}

export function TeamMembersDialog({
  teamId,
  teamName,
  onClose,
}: {
  teamId: string;
  teamName: string;
  onClose: () => void;
}) {
  const { viewerId, helpHref, navigate } = useExplorer();
  const [load, reload] = useTeamDetails(teamId);
  return (
    <Dialog onClose={onClose} ariaLabel={`${teamName} members`} size="lg">
      <DialogHeader title={teamName} subtitle="Members">
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div className="px-5 py-4" data-team-members-dialog={teamId}>
        {load.state === 'found' ? (
          <TeamCard
            details={load.details}
            reload={reload}
            viewerId={viewerId}
            helpHref={helpHref?.({ kind: 'team', id: teamId })}
            onGone={() => {
              onClose();
              navigate({ kind: 'home' });
              landOnPanelHome();
            }}
          />
        ) : load.state === 'loading' ? (
          <PaneSkeleton rows={3} />
        ) : (
          <PaneEmpty
            icon={<TeamIcon size={22} />}
            title={load.state === 'gone' ? 'Team not found' : 'The team could not load'}
            description={
              load.state === 'gone'
                ? 'This team doesn’t exist, or you’re not a member of it.'
                : 'Check your connection and try again.'
            }
          />
        )}
      </div>
    </Dialog>
  );
}
