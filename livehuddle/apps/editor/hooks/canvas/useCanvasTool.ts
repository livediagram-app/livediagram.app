// Canvas tool slice, lifted out of useEditorState. Select (default,
// drag-on-empty marquee-selects) vs Pan (drag-on-empty scrolls) vs
// Avatar (walk mode, docs/specs/008-canvas/avatar-mode.md). Holding
// Space always pans regardless.
// Lives in editor state (not Canvas) so other components (e.g. a
// status bar later) can read it without prop-drilling through Canvas.

import { useRef, useState } from 'react';
import type { CanvasTool } from '@/components/palette/palette.types';
import { isMobileViewportSync } from '@liveworkspace/workbench/lib/responsive';
import { track } from '@/lib/telemetry';

export function useCanvasTool({
  defaultPan = false,
  tabId,
}: {
  defaultPan?: boolean;
  /** The active tab. Avatar mode is left when it changes (docs/specs/008-canvas/avatar-mode.md "Changing tab"). */
  tabId?: string;
} = {}) {
  // Default to Hand (pan) on a touch / mobile viewport, Select on
  // desktop: on a small touchscreen a drag-on-empty far more often
  // means "scroll the canvas" than "marquee-select", and pinch-zoom
  // pairs naturally with panning. Lazy initial read is safe during the
  // static-export render (see isMobileViewportSync). `defaultPan` forces
  // Hand on every viewport, used by the read-only embed view (docs/specs/013-workspace/embeds.md):
  // there's nothing to select / edit, so panning is the only useful
  // drag-on-empty gesture.
  // The device's default (Select on a desktop, Hand on a touch screen), read once: also where leaving Avatar mode
  // lands when nothing came before it (docs/specs/008-canvas/avatar-mode.md "Reaching for the palette").
  const [defaultTool] = useState<CanvasTool>(() =>
    defaultPan || isMobileViewportSync() ? 'pan' : 'select',
  );
  const [chosenTool, setChosenTool] = useState<CanvasTool>(defaultTool);
  // A Participant is always walking (docs/specs/013-workspace/share-roles.md "A Participant walks"): held by
  // `holdWalking`, called as the editor renders with the session's level. While held the tool reads 'avatar' and
  // every way out (a pick, a key, a button, the palette reach, a change of tab) is refused; the tool chosen before
  // stays underneath, so a preview that ends hands it back.
  const [alwaysWalking, setAlwaysWalking] = useState(false);
  const canvasTool: CanvasTool = alwaysWalking ? 'avatar' : chosenTool;
  const setCanvasTool = (tool: CanvasTool) => {
    if (alwaysWalking && tool !== 'avatar') return;
    setChosenTool(tool);
  };
  const holdWalking = (hold: boolean) => {
    if (hold !== alwaysWalking) setAlwaysWalking(hold);
  };
  // User-facing tool picker (palette buttons + keyboard). Wraps the raw
  // setter to emit telemetry when the user enters a distinct mode (Avatar,
  // Format). Pan / select switches stay untracked (high frequency),
  // and internal auto-switches keep the raw setter so they don't count as a use.
  // The tool that was active before Avatar mode (docs/specs/008-canvas/avatar-mode.md) took over, so
  // picking a palette tile can put the user back exactly where they were
  // rather than guessing Select. Same idea as useFormatTool's preFormatToolRef.
  const [preAvatarTool, setPreAvatarTool] = useState<CanvasTool>(defaultTool);
  // The general form of the same idea: whatever tool you were in before the
  // current one, for any mode. A Selection Mode button (docs/specs/009-elements/mode-button.md) presses back
  // out of its own mode with this, so a button that switches you in is never a
  // one-way door.
  const priorToolRef = useRef<CanvasTool>(defaultTool);
  const selectCanvasTool = (tool: CanvasTool) => {
    if (alwaysWalking) return;
    if (tool !== canvasTool) priorToolRef.current = canvasTool;
    if (tool === 'avatar' && canvasTool !== 'avatar') setPreAvatarTool(canvasTool);
    // `AvatarMode`, not `Avatar` — the palette's Avatar photo tile already owns
    // the `Avatar` token on Element·Added (docs/specs/008-canvas/avatar-mode.md).
    if (tool === 'avatar' && canvasTool !== 'avatar') track('Canvas', 'Used', 'AvatarMode');
    if (tool === 'format' && canvasTool !== 'format') track('Canvas', 'Used', 'FormatPainter');
    setCanvasTool(tool);
  };
  // Opening walking (docs/specs/008-canvas/avatar-mode.md "Opening walking"): a tab that offers the walk puts you in
  // Avatar mode when it is first shown. The same entry as a pick, remembering where you were so every way out leads
  // back there, but untracked: it counts people who chose the walk, and nobody chose this one.
  const openWalking = () => {
    if (canvasTool === 'avatar') return;
    priorToolRef.current = canvasTool;
    setPreAvatarTool(canvasTool);
    setCanvasTool('avatar');
  };
  // Leave Avatar mode for the tool that preceded it. Called when the user
  // reaches for the palette mid-walk (docs/specs/008-canvas/avatar-mode.md): a tile is an edit, and the
  // mode is read-only, so the character steps aside instead of swallowing the
  // click. A no-op in every other tool, so callers can fire it blind. The
  // remembered tool can't itself be 'avatar' (selectCanvasTool only records a
  // change INTO the mode), but guard anyway so a stale ref can't trap the user.
  const exitAvatarTool = () => {
    if (canvasTool !== 'avatar') return;
    const back = preAvatarTool;
    setCanvasTool(back === 'avatar' ? defaultTool : back);
  };
  // Changing tab leaves Avatar mode for the tool you were in before it (docs/specs/008-canvas/avatar-mode.md
  // "Changing tab"): the character stands at a point of the tab you left, which on the new tab can be inside a
  // fence it was meant to be kept out of. Done while rendering, as the tab changes, so the new tab never draws
  // (or publishes to peers) the character even once; leaving the mode is also what tells peers to drop it.
  // Travel keeps the mode ("Changing tab"): a Portal, an Elevator or the Directory's Go names the tab it is taking
  // you to, and places the character there in the same update, so that one change of tab is not an exit.
  const [lastTabId, setLastTabId] = useState(tabId);
  const [travelTabId, setTravelTabId] = useState<string | null>(null);
  if (tabId !== lastTabId) {
    setLastTabId(tabId);
    const travelling = travelTabId !== null && travelTabId === tabId;
    if (travelTabId !== null) setTravelTabId(null);
    if (chosenTool === 'avatar' && !travelling && !alwaysWalking) {
      const back = preAvatarTool;
      setChosenTool(back === 'avatar' ? defaultTool : back);
    }
  }
  // Where "go back" leads: the tool before the current one, never the current
  // one itself (a stale ref must not trap the user in the mode they're leaving).
  const toolBeforeCurrent = (): CanvasTool =>
    priorToolRef.current === canvasTool ? defaultTool : priorToolRef.current;
  // Marks the next change of tab, to `id`, as travel, which keeps Avatar mode. Called with the tab switch itself.
  const keepWalkingTo = (id: string) => {
    if (id !== tabId) setTravelTabId(id);
  };
  return {
    canvasTool,
    setCanvasTool,
    keepWalkingTo,
    holdWalking,
    selectCanvasTool,
    openWalking,
    exitAvatarTool,
    toolBeforeCurrent,
  };
}
