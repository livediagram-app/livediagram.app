'use client';

import dynamic from 'next/dynamic';

import { useEditorChrome, useEditorContext } from '@/app/document/[id]/EditorContext';
import { useSelectTab } from '@/app/document/[id]/useSelectTab';

const CollaboratorsDialog = dynamic(
  () => import('@/components/dialogs/CollaboratorsDialog').then((m) => m.CollaboratorsDialog),
  { ssr: false },
);

// Mounts the Collaborators modal (docs/specs/012-collaboration/collaborator-enhancements.md) from EditorContext, so EditorView
// only drops <CollaboratorsHost /> in. Going to a tab or starting a follow
// closes the modal: both are "take me there", and the modal would sit over
// exactly what you asked to see.
// The Collaborators dialog, open or not.
// Only whether one is open is read until it is (docs/specs/007-editor/blueprints/flashcards.md "Performance and
// limits"): a typing commit renders nothing here.
export function CollaboratorsHost() {
  const open = useEditorChrome((s) => !!s.collaborators);
  return open ? <OpenCollaboratorsHost /> : null;
}

function OpenCollaboratorsHost() {
  const {
    collaborators,
    closeCollaborators,
    participantsByTab,
    tabs,
    activeId,
    selfParticipant,
    sessionRole,
    followMe,
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
      onClose={closeCollaborators}
    />
  );
}
