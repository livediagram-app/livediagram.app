'use client';

import dynamic from 'next/dynamic';

import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useSelectTab } from '@/app/document/[id]/useSelectTab';
import { proOn } from '@liveworkspace/subscription-ui/flag';

const CollaboratorsDialog = dynamic(
  () => import('@/components/dialogs/CollaboratorsDialog').then((m) => m.CollaboratorsDialog),
  { ssr: false },
);
// The Space's Call Minutes (docs/specs/012-collaboration/call-minutes.md "What people see"): with Pro on, loaded
// with the dialog; with it off, never loaded.
const CallMinutesSection = dynamic(
  () => import('@/components/calls/minutes/CallMinutesSection').then((m) => m.CallMinutesSection),
  { ssr: false },
);

// Mounts the Collaborators modal (docs/specs/012-collaboration/collaborator-enhancements.md) from EditorContext, so EditorView
// only drops <CollaboratorsHost /> in. Going to a tab or starting a follow
// closes the modal: both are "take me there", and the modal would sit over
// exactly what you asked to see.
export function CollaboratorsHost() {
  const {
    collaborators,
    closeCollaborators,
    participantsByTab,
    tabs,
    activeId,
    selfParticipant,
    sessionRole,
    followMe,
    nudges,
    facilitator,
    isOwner,
    imageContext,
  } = useEditorContext();
  const selectTab = useSelectTab();
  if (!collaborators) return null;
  return (
    <CollaboratorsDialog
      participantsByTab={participantsByTab}
      tabs={tabs}
      activeId={activeId}
      selfId={selfParticipant.id}
      selfRole={sessionRole}
      focusId={collaborators.focusId}
      followingId={followMe.followingId}
      onGoToTab={(tabId) => {
        selectTab(tabId);
        closeCollaborators();
      }}
      onFollow={(id) => {
        followMe.startFollowing(id);
        closeCollaborators();
      }}
      onStopFollowing={followMe.stopFollowing}
      onNudge={nudges.canNudge ? nudges.nudge : undefined}
      facilitatorId={facilitator.facilitatorId}
      isFacilitator={facilitator.isFacilitator}
      isOwner={isOwner}
      onMakeFacilitator={facilitator.grantFacilitator}
      onTakeFacilitation={facilitator.claimFacilitator}
      onStepDown={facilitator.releaseFacilitator}
      onClose={closeCollaborators}
      below={proOn() ? <CallMinutesSection caller={imageContext ?? null} /> : undefined}
    />
  );
}
