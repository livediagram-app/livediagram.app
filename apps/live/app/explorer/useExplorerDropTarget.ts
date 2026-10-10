'use client';

import { useDocumentDropTarget } from '@/components/panels/useDocumentDropTarget';
import { debugLog } from '@/lib/debug-log';
import { isLocalOnly } from '@/lib/document-space';
import { useOptionalExplorer } from './ExplorerContext';
import { planDocumentDrop, type DropPlace } from './document-drop';

// A place on the Explorer page that takes a dragged document (docs/specs/013-workspace/folders.md
// "Drag-and-drop"): a sidebar folder, My documents, a team or team folder, a folder row or card in
// the pane. The move goes through the move picker's own path (`moveDocumentTo`), so a drop and a
// pick land identically: optimistic update, rollback and telemetry (`Document·Moved`, `Team·…`).
// `onLongHover` opens or closes an expandable row while a drag rests on it. Outside the Explorer
// page (no ExplorerContext) the place takes no drops.
export function useExplorerDropTarget(to: DropPlace, opts: { onLongHover?: () => void } = {}) {
  const explorer = useOptionalExplorer();

  const drop = (id: string) => {
    if (!explorer) return;
    const { documents, teamDocuments, moveDocumentTo } = explorer;
    const team = teamDocuments.find((d) => d.id === id);
    const own = team ? null : documents.find((d) => d.id === id);
    if (!team && !own) {
      // Shared-with-you rows are never drag sources; anything else unknown is a stale row.
      console.warn(`[explorer-drop] unknown document=${id}; nothing moved`);
      return;
    }
    const from: DropPlace = team
      ? { teamId: team.team.id, folderId: team.folderId }
      : { teamId: null, folderId: own!.folderId };
    const plan = planDocumentDrop({ from, to, localOnly: own ? isLocalOnly(own) : false });
    debugLog(
      `[explorer-drop] ${plan} document=${id} to=${to.teamId ? 'team' : 'personal'}:${to.folderId ? 'folder' : 'root'}`,
    );
    if (plan !== 'move') return;
    moveDocumentTo(id, to);
  };

  return useDocumentDropTarget(explorer ? drop : undefined, {
    onLongHover: opts.onLongHover,
    // A team's library lives on the server: no drop for a document only in this browser.
    refuseLocalOnly: to.teamId !== null,
  });
}
