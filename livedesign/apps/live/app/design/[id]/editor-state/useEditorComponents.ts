import type { Tab } from '@livedesign/design';
import { useComponentSession } from '../useComponentSession';
import { useComponentActions } from '../useComponentActions';
import type { EditorDocument } from './useEditorDocument';
import type { EditorSelection } from './useEditorSelection';
import type { EditorSession } from './useEditorSession';
import type { EditorPersistence } from './useEditorPersistence';
import type { EditorCollaboration } from './useEditorCollaboration';
import type { EditorViewport } from './useEditorViewport';
import type { EditorPages } from './useEditorPages';

// Components (docs/specs/009-elements/components.md): the component actions and editing sessions, and the
// active-tab commit the layer and component operations use.
//
// One slice of useEditorState (../useEditorState.ts), which calls the slices in order and passes each the ones
// before it.
export function useEditorComponents({
  documentSlice,
  selectionSlice,
  sessionSlice,
  persistenceSlice,
  collaborationSlice,
  viewportSlice,
  pagesSlice,
}: {
  documentSlice: EditorDocument;
  selectionSlice: EditorSelection;
  sessionSlice: EditorSession;
  persistenceSlice: EditorPersistence;
  collaborationSlice: EditorCollaboration;
  viewportSlice: EditorViewport;
  pagesSlice: EditorPages;
}) {
  const { ownedComponentSessions, commitTabs } = documentSlice;
  const { activeId, setSelectedId, setMultiSelectedIds } = selectionSlice;
  const { selfParticipant, canEdit, participant } = sessionSlice;
  const { tabsRef } = persistenceSlice;
  const { componentLibrary, activeTab } = collaborationSlice;
  const { getViewportCenter } = viewportSlice;
  const { editsBlocked, commit } = pagesSlice;
  // Components (docs/specs/009-elements/components.md): an Editor's actions, and the edit session's derive.
  const componentActions = useComponentActions({
    canEdit: canEdit && !editsBlocked,
    selfId: selfParticipant.id,
    elements: activeTab.elements,
    commit,
    library: componentLibrary,
    select: (ids) => {
      setSelectedId(ids.length === 1 ? ids[0]! : null);
      setMultiSelectedIds(new Set(ids.length > 1 ? ids : []));
    },
    viewCentre: getViewportCenter,
    owned: ownedComponentSessions,
  });
  const componentSession = useComponentSession({
    canEdit,
    selfId: selfParticipant.id,
    elements: activeTab.elements,
    library: componentLibrary,
    owned: ownedComponentSessions,
  });

  // Tab-level history commit scoped to the ACTIVE tab, for mutations
  // that touch more than the elements array — the layer ops and the
  // layer-aware Bring to Front / Send to Back also restack
  // `tab.layers`. Reads the LIVE tab (same rationale as `commit`).
  const commitActiveTab = (mapTab: (t: Tab) => Tab) => {
    if (editsBlocked) return;
    const liveTab = tabsRef.current.find((t) => t.id === activeId) ?? activeTab;
    const next = mapTab(liveTab);
    if (next === liveTab) return;
    if (participant.participating && !participant.guardCommit(liveTab, next)) return;
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? mapTab(t) : t)));
  };

  return { componentActions, componentSession, commitActiveTab };
}

export type EditorComponents = ReturnType<typeof useEditorComponents>;
