// A column's settings asking to open on another column (docs/specs/026-plan/plan-board.md "A column's own
// settings"): + Add Column After closes its popover and asks the new column's head to open its own, named
// fresh. The new head reads the request when it mounts (the set-up change draws it), or as it is made should
// the head already be on screen. One request at a time; the head that takes it clears it. A right-click on a
// column's background asks too, not fresh: the settings open as the cog opens them (columnBackgroundMenu).
import type React from 'react';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

let pending: { columnId: string; fresh: boolean } | null = null;
const listeners = createListeners();

// `fresh`: the name opens selected, ready to type over (a column just added).
export function requestColumnSettings(columnId: string, fresh = true): void {
  pending = { columnId, fresh };
  listeners.notify();
}

// The request for `columnId`, taken (cleared) when it matches: whether its name opens selected.
export function takeColumnSettingsRequestOf(columnId: string): { fresh: boolean } | null {
  if (pending?.columnId !== columnId) return null;
  const { fresh } = pending;
  pending = null;
  return { fresh };
}

export function takeColumnSettingsRequest(columnId: string): boolean {
  return takeColumnSettingsRequestOf(columnId) !== null;
}

export const subscribeColumnSettingsRequest = listeners.subscribe;

// A right-click on a column's empty background (its cell, not a card) opens the column's settings, anchored to its
// cog, instead of the board's element menu, the tab's menu or the browser's (plan-board.md "A column's own
// settings"). A card's own menu has already taken its right-click (default prevented); a right-click inside a
// portalled popover bubbles here through React but is not on the column, so it is left alone.
export function columnBackgroundMenu(columnId: string) {
  return (e: React.MouseEvent<HTMLElement>) => {
    if (e.defaultPrevented) return;
    if (!(e.target instanceof Node) || !e.currentTarget.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    requestColumnSettings(columnId, false);
  };
}
