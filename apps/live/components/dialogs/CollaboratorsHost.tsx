'use client';

import dynamic from 'next/dynamic';

import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useSelectTab } from '@/app/document/[id]/useSelectTab';

const CollaboratorsDialog = dynamic(
  () => import('@/components/dialogs/CollaboratorsDialog').then((m) => m.CollaboratorsDialog),
  { ssr: false },
);

// Mounts the Collaborators modal (docs/specs/012-collaboration/collaborator-enhancements.md) from EditorContext, so EditorView
// only drops <CollaboratorsHost /> in. Going to a tab closes the modal: it is
// "take me there", and the modal would sit over exactly what you asked to see.
export function CollaboratorsHost() {
  const {
    collaborators,
    closeCollaborators,
    participantsByTab,
    tabs,
    activeId,
    selfParticipant,
    sessionRole,
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
      onGoToTab={(tabId) => {
        selectTab(tabId);
        closeCollaborators();
      }}
      onClose={closeCollaborators}
    />
  );
}
