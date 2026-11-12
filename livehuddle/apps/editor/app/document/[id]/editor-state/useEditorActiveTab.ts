'use client';

import { useTokenTeams } from '@/lib/explorer-host';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorHistorySlice } from './useEditorUndoState';
import type { EditorSelectionSlice } from './useEditorSelection';

// The active tab every later slice reads, and the signed-in person's teams. A slice of useEditorState
// (../useEditorState.ts): it takes the slices composed before it and returns its own, with `view`, its part of the
// editor's view-model. It used to be the comments slice too; comments, mentions, reactions and assigned actions left
// livehuddle (docs/specs/002-project-scope/not-in-livehuddle.md "Comments, actions, links and notes").
export function useEditorActiveTab({
  fromDocument,
  fromHistory,
  fromSelection,
}: {
  fromDocument: EditorDocumentSlice;
  fromHistory: EditorHistorySlice;
  fromSelection: EditorSelectionSlice;
}) {
  const { accountUserId } = fromDocument;
  const { tabs } = fromHistory;
  const { activeId } = fromSelection;
  // Teams the signed-in user belongs to (docs/specs/013-workspace/teams.md), for the Explorer panel's Teams and the
  // current team document (docs/specs/013-workspace/team-shared-documents.md), so they load for the whole session.
  // Guests can't have teams, so the read waits for an account id.
  const teams = useTokenTeams(!!accountUserId);
  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0]!;
  return {
    activeTab,
    view: { activeTab, teams },
  };
}

export type EditorActiveTabSlice = ReturnType<typeof useEditorActiveTab>;
