'use client';

import { useDesignDropTarget } from '@/components/panels/useDesignDropTarget';
import { debugLog } from '@/lib/debug-log';
import { isInThisBrowser } from '@/lib/design-space';
import { useOptionalExplorer } from './ExplorerContext';
import { planDesignDrop, type DropPlace } from './design-drop';

// A place on the Explorer page that takes a dragged design (docs/specs/013-workspace/folders.md
// "Drag-and-drop"): a sidebar folder, My Work, a team or team folder, a folder row or card in
// the pane. The move goes through the move picker's own path (`moveDesignTo`), so a drop and a
// pick land identically: optimistic update, rollback and telemetry (`Document·Moved`, `Team·…`).
// `onLongHover` opens or closes an expandable row while a drag rests on it. Outside the Explorer
// page (no ExplorerContext) the place takes no drops.
export function useExplorerDropTarget(to: DropPlace, opts: { onLongHover?: () => void } = {}) {
  const explorer = useOptionalExplorer();

  const drop = (id: string) => {
    if (!explorer) return;
    const { designs, teamDesigns, moveDesignTo } = explorer;
    const team = teamDesigns.find((d) => d.id === id);
    const own = team ? null : designs.find((d) => d.id === id);
    if (!team && !own) {
      // Shared-with-you rows are never drag sources; anything else unknown is a stale row.
      console.warn(`[explorer-drop] unknown design=${id}; nothing moved`);
      return;
    }
    const from: DropPlace = team
      ? { teamId: team.team.id, folderId: team.folderId }
      : { teamId: null, folderId: own!.folderId };
    const plan = planDesignDrop({ from, to, localOnly: own ? isInThisBrowser(own) : false });
    debugLog(
      `[explorer-drop] ${plan} design=${id} to=${to.teamId ? 'team' : 'personal'}:${to.folderId ? 'folder' : 'root'}`,
    );
    if (plan !== 'move') return;
    moveDesignTo(id, to);
  };

  return useDesignDropTarget(explorer ? drop : undefined, {
    onLongHover: opts.onLongHover,
    // A team's library lives on the server: no drop for a design only in this browser.
    refuseLocalOnly: to.teamId !== null,
  });
}
