'use client';

// Two pieces of ToolbarPalette's state (docs/specs/007-editor/toolbar-layout.md): the category switch, with the
// old category's tiles kept while they animate out, and the Search popover's opening, from its button or the S
// key. Hooks the palette calls in its own order.

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { onToolbarSearchRequest } from '@liveworkspace/workbench/lib/toolbar-search-request';
import type { useStripPopover } from '@liveworkspace/workbench/components/palette/ToolbarStripPopover';
import { track } from '@/lib/telemetry';
import { RAIL_LEAVE_MS } from './ToolbarStripRail';
import { catalogueStripGroups } from './catalogue-strip-groups';
import { stripTilesFor } from './toolbar-strip-tiles';
import type { usePaletteCatalogue } from './usePaletteCatalogue';
import type { useCategoryBar } from './CategoryBar';
import type { PaletteProps } from './palette.types';

type Catalogue = ReturnType<typeof usePaletteCatalogue>;
type StripPopoverState = ReturnType<typeof useStripPopover>;

export function useCategorySwitch({
  categoryId,
  setCategoryId,
  setMoreOpen,
  tabs,
  tileActions,
  tileLimit,
}: {
  categoryId: string;
  setCategoryId: (id: string) => void;
  setMoreOpen: (open: boolean) => void;
  tabs: Catalogue['tabs'];
  tileActions: Catalogue['tileActions'];
  tileLimit: number;
}) {
  // The category being switched AWAY from, while its tiles animate out
  // (ToolbarStripRail). Rebuilt from data rather than kept as stale nodes, and
  // cleared once the exit has played.
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const leaveTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
    },
    [],
  );
  // The category picker: the strip swaps to the new tiles (animated) and any
  // open More popover closes, since it was showing the old category.
  const switchCategory = (id: string) => {
    if (id === categoryId) return;
    setLeavingId(categoryId);
    setCategoryId(id);
    setMoreOpen(false);
    if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => setLeavingId(null), RAIL_LEAVE_MS);
    track('UI', 'Changed', 'ToolbarCategory');
  };
  // A catalogue leaves as the groups it showed.
  const leavingGroups = leavingId ? catalogueStripGroups(leavingId) : null;
  const leaving = leavingId
    ? stripTilesFor(leavingId, {
        hasImage: tileActions.hasImage,
        limit: tileLimit,
        tiles: tabs.find((t) => t.id === leavingId)?.tiles,
      })
    : null;
  return { leavingId, leavingGroups, leaving, switchCategory };
}

export function useToolbarSearch({
  search,
  more,
  bar,
  pendingDraw,
  tileActions,
  esBoard,
  participant,
  hidden,
}: {
  search: StripPopoverState;
  more: StripPopoverState;
  bar: ReturnType<typeof useCategoryBar>;
  pendingDraw: PaletteProps['pendingDraw'];
  tileActions: Catalogue['tileActions'];
  esBoard: PaletteProps['esBoard'];
  participant: boolean;
  hidden: boolean | undefined;
}) {
  // Opening the Search starts a new choice: a tile armed to place (its "Click to drop" banner) is let go first.
  const beforeSearch = () => {
    if (pendingDraw) tileActions.cancelDraw?.();
  };
  // S asks for the Search (lib/toolbar-search-request): answered only while it is on show, so the
  // key keeps its Select meaning on an event-storming board or with the chrome away.
  const searchButtonRef = useRef<HTMLDivElement>(null);
  const openSearchFromKey = useEffectEvent(() => {
    const button = searchButtonRef.current?.querySelector<HTMLElement>(
      '[data-toolbar-search-button]',
    );
    if (!button || search.open) return;
    more.setOpen(false);
    bar.popover.setOpen(false);
    beforeSearch();
    track('UI', 'Opened', 'ToolbarSearch');
    search.openFrom(button);
  });
  useEffect(() => {
    if (esBoard || participant || hidden) return;
    return onToolbarSearchRequest(() => openSearchFromKey());
  }, [esBoard, participant, hidden]);
  const toggleSearch = (button: HTMLElement) => {
    if (search.open) return search.setOpen(false);
    beforeSearch();
    track('UI', 'Opened', 'ToolbarSearch');
    search.openFrom(button);
  };
  return { searchButtonRef, toggleSearch };
}
