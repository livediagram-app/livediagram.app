'use client';

import dynamic from 'next/dynamic';

import { useEditorContext } from '@/app/diagram/[id]/EditorContext';
import { useSelectTab } from '@/app/diagram/[id]/useSelectTab';

const CollaboratorsDialog = dynamic(() =>
  import('@/components/dialogs/CollaboratorsDialog').then((m) => m.CollaboratorsDialog),
);

// Mounts the Collaborators modal (spec/145) from EditorContext, so EditorView
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
    facilitator,
    isOwner,
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
      facilitatorId={facilitator.facilitatorId}
      isFacilitator={facilitator.isFacilitator}
      isOwner={isOwner}
      onMakeFacilitator={facilitator.grantFacilitator}
      onTakeFacilitation={facilitator.claimFacilitator}
      onStepDown={facilitator.releaseFacilitator}
      onClose={closeCollaborators}
    />
  );
}
