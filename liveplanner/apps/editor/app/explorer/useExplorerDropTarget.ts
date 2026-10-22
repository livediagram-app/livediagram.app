'use client';

import { useProjectDropTarget } from '@/components/panels/useProjectDropTarget';
import { debugLog } from '@/lib/debug-log';
import { isInThisBrowser } from '@/lib/project-space';
import { useOptionalExplorer } from './ExplorerContext';
import { planProjectDrop, type DropPlace } from './project-drop';

// A place on the Explorer page that takes a dragged project (docs/specs/013-workspace/folders.md
// "Drag-and-drop"): a sidebar folder, My Work, a team or team folder, a folder row or card in
// the pane. The move goes through the move picker's own path (`moveProjectTo`), so a drop and a
// pick land identically: optimistic update, rollback and telemetry (`Project·Moved`, `Team·…`).
// `onLongHover` opens or closes an expandable row while a drag rests on it. Outside the Explorer
// page (no ExplorerContext) the place takes no drops.
export function useExplorerDropTarget(to: DropPlace, opts: { onLongHover?: () => void } = {}) {
  const explorer = useOptionalExplorer();

  const drop = (id: string) => {
    if (!explorer) return;
    const { projects, teamProjects, moveProjectTo } = explorer;
    const team = teamProjects.find((d) => d.id === id);
    const own = team ? null : projects.find((d) => d.id === id);
    if (!team && !own) {
      // Shared-with-you rows are never drag sources; anything else unknown is a stale row.
      console.warn(`[explorer-drop] unknown project=${id}; nothing moved`);
      return;
    }
    const from: DropPlace = team
      ? { teamId: team.team.id, folderId: team.folderId }
      : { teamId: null, folderId: own!.folderId };
    const plan = planProjectDrop({ from, to, localOnly: own ? isInThisBrowser(own) : false });
    debugLog(
      `[explorer-drop] ${plan} project=${id} to=${to.teamId ? 'team' : 'personal'}:${to.folderId ? 'folder' : 'root'}`,
    );
    if (plan !== 'move') return;
    moveProjectTo(id, to);
  };

  return useProjectDropTarget(explorer ? drop : undefined, {
    onLongHover: opts.onLongHover,
    // A team's library lives on the server: no drop for a project only in this browser.
    refuseLocalOnly: to.teamId !== null,
  });
}
