'use client';

// What the Explorer adds to a Timeline card that a renderer can't
// (spec/138 §2.8, §2.9): the ⋯ menu, and the inline rename that one of
// its items starts.
//
// Every card gets a menu, because every card can be removed from the
// reader's own feed. A card about a diagram the Explorer has loaded gets
// the full diagram menu on top: an event only NAMES a diagram, and the
// menu's items depend on its folder, team, share and owner, so the id
// is resolved against the Explorer's already-loaded lists (personal,
// team, shared-with-you), the same set Recent draws from. Nothing found
// (a tombstone, or a team diagram the sidebar hasn't loaded) means the
// one-verb menu: a menu of guesses is worse than none, and the card
// still opens the diagram on click.

import { useCallback, useMemo, useState } from 'react';
import type { TimelineCardSlotsFor, TimelineEvent } from '@livediagram/ui';
import { InlineRenameInput } from '@/components/primitives/InlineRenameInput';
import { isOfflineIdSync } from '@/lib/offline/offline-store';
import { track } from '@/lib/telemetry';
import { useExplorer } from '../ExplorerContext';
import { sharedToPaneDiagram, type PaneDiagram } from '../views';
import { TimelineCardMenu } from './TimelineCardMenu';

function diagramIdOf(snapshot: Record<string, unknown>): string | null {
  const id = snapshot['diagramId'];
  return typeof id === 'string' && id.length > 0 ? id : null;
}

// The card's subject as the menu header should name it. Renderers
// build the on-card subject from the same snapshot keys; this is the
// plain-string reading of it, for a menu that can't take a node.
const SUBJECT_KEYS = ['diagramName', 'teamName', 'folderName', 'themeName', 'tokenName'];
function subjectOf(event: TimelineEvent): string {
  for (const key of SUBJECT_KEYS) {
    const v = event.snapshot?.[key];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return event.description || event.title;
}

export function useTimelineCardSlots({
  onShowHistory,
  onDismiss,
}: {
  onShowHistory: (id: string, name: string) => void;
  /** Take one card off the reader's feed (spec/138 §2.9). */
  onDismiss: (eventId: string) => void;
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

  // Memoised: a fresh `?? []` each render would make the slot callback
  // below a new function every render.
  const recentExcluded = useMemo(() => prefs.recentExcludedIds ?? [], [prefs.recentExcludedIds]);

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
      const id = event.sourceType === 'diagram' ? diagramIdOf(event.snapshot) : null;
      const diagram = id ? byId.get(id) : undefined;
      const menuProps = {
        open: menuFor === event.id,
        onOpenChange: (open: boolean) => openMenu(open ? event.id : null),
        onRemove: () => onDismiss(event.id),
      };
      const onContextMenu = (e: { preventDefault: () => void }) => {
        e.preventDefault();
        openMenu(event.id);
      };

      if (!id || !diagram) {
        return {
          onContextMenu,
          menu: <TimelineCardMenu subject={subjectOf(event)} {...menuProps} />,
        };
      }

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
        // Right-click is off while renaming: the card's own gesture would
        // fight the input's.
        onContextMenu: title ? undefined : onContextMenu,
        menu: (
          <TimelineCardMenu
            subject={diagram.name}
            diagram={diagram}
            {...menuProps}
            handlers={{
              ownerId,
              onStartRename: () => setRenamingDiagramId(id),
              onDuplicate: () => void duplicateDiagram(id),
              onMove: (anchor) => openMovePickerForDiagram(id, anchor),
              onDelete: () => void deleteDiagram(id),
              onDismiss: diagram.shared ? () => dismissShared(id) : undefined,
              favourite: favouriteIds.has(id),
              onToggleFavourite: () => toggleFavourite(id),
              recentExcluded: recentExcluded.includes(id),
              onToggleRecentExclusion: () => toggleRecentExclusion(id),
              // Offline diagrams never reach the worker, so they have no
              // server history to show (spec/76).
              onShowHistory: isOfflineIdSync(id)
                ? undefined
                : () => onShowHistory(id, diagram.name),
            }}
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
      onDismiss,
    ],
  );
}
