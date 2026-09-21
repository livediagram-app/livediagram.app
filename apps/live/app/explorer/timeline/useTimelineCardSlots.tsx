'use client';

// What the Explorer adds to a Timeline card that a renderer can't
// (spec/138 §2.8): the ⋯ menu, and the inline rename that one of its
// items starts.
//
// An event only NAMES a diagram; the menu's items depend on its folder,
// team, share and owner, so the id is resolved against the Explorer's
// already-loaded lists (personal, team, shared-with-you), the same set
// Recent draws from. Nothing found means no menu: a menu of guesses is
// worse than none, and the card still opens the diagram on click.

import { useCallback, useMemo, useState } from 'react';
import type { TimelineCardSlotsFor } from '@livediagram/ui';
import { InlineRenameInput } from '@/components/primitives/InlineRenameInput';
import { isOfflineIdSync } from '@/lib/offline/offline-store';
import { track } from '@/lib/telemetry';
import { useExplorer } from '../ExplorerContext';
import { sharedToPaneDiagram, type PaneDiagram } from '../views';
import { TimelineDiagramMenu } from './TimelineDiagramMenu';

function diagramIdOf(snapshot: Record<string, unknown>): string | null {
  const id = snapshot['diagramId'];
  return typeof id === 'string' && id.length > 0 ? id : null;
}

export function useTimelineCardSlots({
  onShowHistory,
}: {
  onShowHistory: (id: string, name: string) => void;
}): TimelineCardSlotsFor {
  const {
    ownerId,
    diagrams,
    teamDiagrams,
    shared,
    renamingDiagramId,
    setRenamingDiagramId,
    renameDiagram,
    deleteDiagram,
    duplicateDiagram,
    openMovePickerForDiagram,
    dismissShared,
    favouriteIds,
    toggleFavourite,
    prefs,
    toggleRecentExclusion,
  } = useExplorer();

  const byId = useMemo(() => {
    const map = new Map<string, PaneDiagram>();
    for (const d of diagrams) map.set(d.id, d);
    for (const d of teamDiagrams) map.set(d.id, d);
    for (const s of shared) map.set(s.id, sharedToPaneDiagram(s));
    return map;
  }, [diagrams, teamDiagrams, shared]);

  const recentExcluded = prefs.recentExcludedIds ?? [];

  // Which card's menu is open, by event id (one diagram can have several
  // cards on a day, and a menu belongs to the card it was opened from).
  // Held here rather than inside the trigger so the card's right-click
  // can open the same menu.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const openMenu = useCallback((eventId: string | null) => {
    if (eventId) track('Timeline', 'Opened', 'Menu');
    setMenuFor(eventId);
  }, []);

  return useCallback(
    (event) => {
      if (event.sourceType !== 'diagram') return undefined;
      const id = diagramIdOf(event.snapshot);
      const diagram = id ? byId.get(id) : undefined;
      if (!id || !diagram) return undefined;

      const title =
        renamingDiagramId === id ? (
          <InlineRenameInput
            initial={diagram.name}
            ariaLabel={`Rename ${diagram.name}`}
            onCommit={(name) => renameDiagram(id, name)}
            onCancel={() => setRenamingDiagramId(null)}
            className="min-w-0 w-full rounded border border-brand-300 bg-white px-1 py-0 text-sm font-medium text-slate-900 dark:border-brand-500/50 dark:bg-slate-900 dark:text-slate-100"
          />
        ) : undefined;

      return {
        // The name as the Explorer knows it now. A card for the create of
        // a diagram renamed since still shows its current name, the same
        // way its preview shows the current picture.
        subject: diagram.name,
        title,
        onContextMenu: title
          ? undefined
          : (e) => {
              e.preventDefault();
              openMenu(event.id);
            },
        menu: (
          <TimelineDiagramMenu
            diagram={diagram}
            open={menuFor === event.id}
            onOpenChange={(open) => openMenu(open ? event.id : null)}
            ownerId={ownerId}
            onStartRename={() => setRenamingDiagramId(id)}
            onDuplicate={() => void duplicateDiagram(id)}
            onMove={(anchor) => openMovePickerForDiagram(id, anchor)}
            onDelete={() => void deleteDiagram(id)}
            onDismiss={diagram.shared ? () => dismissShared(id) : undefined}
            favourite={favouriteIds.has(id)}
            onToggleFavourite={() => toggleFavourite(id)}
            recentExcluded={recentExcluded.includes(id)}
            onToggleRecentExclusion={() => toggleRecentExclusion(id)}
            // Offline diagrams never reach the worker, so they have no
            // server history to show (spec/76).
            onShowHistory={isOfflineIdSync(id) ? undefined : () => onShowHistory(id, diagram.name)}
          />
        ),
      };
    },
    [
      byId,
      menuFor,
      openMenu,
      ownerId,
      renamingDiagramId,
      setRenamingDiagramId,
      renameDiagram,
      deleteDiagram,
      duplicateDiagram,
      openMovePickerForDiagram,
      dismissShared,
      favouriteIds,
      toggleFavourite,
      recentExcluded,
      toggleRecentExclusion,
      onShowHistory,
    ],
  );
}
