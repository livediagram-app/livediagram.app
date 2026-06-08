'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ALL_SELECTED_ACCORDIONS_CLOSED,
  SelectedElementSection,
  TabSection,
  type SelectedAccordionState,
  type SelectedElementControls,
  type TabAccordionState,
  type TabSectionControls,
} from './CommandPalette';
import { MovablePanel } from './MovablePanel';

// Idle-timeout for the accordions inside the Editor panel: 20 s of
// no pointer / keyboard activity inside the panel content collapses
// every open accordion. Same goal as auto-collapsing a menu the user
// has walked away from — keeps the panel compact for the next
// glance instead of demanding a manual close. See
// `useAutoCloseAfterIdle` below.
const ACCORDION_IDLE_MS = 20000;

// Watches a container element for interaction. Whenever `anyOpen` is
// true, install pointerdown / pointermove / keydown listeners scoped
// to the container; if `ACCORDION_IDLE_MS` passes with no event, call
// `closeAll()`. Scoping to the container (not document) means moving
// the cursor on the canvas does NOT count as engagement — only
// interaction inside the panel resets the timer.
function useAutoCloseAfterIdle(
  containerRef: React.RefObject<HTMLElement | null>,
  anyOpen: boolean,
  closeAll: () => void,
) {
  useEffect(() => {
    if (!anyOpen) return;
    const el = containerRef.current;
    if (!el) return;

    let timerId: number | undefined;
    const reset = () => {
      if (timerId) window.clearTimeout(timerId);
      timerId = window.setTimeout(closeAll, ACCORDION_IDLE_MS);
    };
    reset(); // start the countdown immediately on accordion open

    el.addEventListener('pointerdown', reset);
    el.addEventListener('pointermove', reset);
    el.addEventListener('keydown', reset);

    return () => {
      if (timerId) window.clearTimeout(timerId);
      el.removeEventListener('pointerdown', reset);
      el.removeEventListener('pointermove', reset);
      el.removeEventListener('keydown', reset);
    };
  }, [anyOpen, closeAll, containerRef]);
}

type ContextPanelProps = {
  position: { x: number; y: number } | null;
  selection: SelectedElementControls | null;
  // 'single' / 'multi' / 'group' — drives the section heading
  // ("Selected Element" / "Selected Elements" / "Selected Group").
  // Defaults to single when omitted so legacy call sites stay
  // unchanged.
  selectionScope?: 'single' | 'multi' | 'group';
  tab: TabSectionControls;
  // Tab-section accordion state lifted to the editor so external
  // triggers (e.g. clicking a "Changed theme to X" entry in the
  // Activity log) can open the matching accordion. Optional so old
  // callers that don't care just get internal state.
  tabAccordionsOpen?: TabAccordionState;
  setTabAccordionsOpen?: React.Dispatch<React.SetStateAction<TabAccordionState>>;
  onMoveTo: (x: number, y: number) => void;
  onReset: () => void;
  // Optional bottom-Y reporter, forwarded through to MovablePanel's
  // onSize so a downstream panel (CommentsPanel today, anything
  // else later) can stack itself just below this one.
  onSize?: (size: { width: number; height: number; bottomY: number }) => void;
  // Bottom-y of the panel this one should stack under (the Palette).
  // When set and the user hasn't dragged this panel anywhere yet, the
  // panel positions itself at `stackBelowY + 16` rather than the
  // legacy static top-[15rem] default, so it follows the Palette as
  // it grows / shrinks (Palette accordions open / close).
  stackBelowY?: number;
  // Bumped by the parent whenever it wants to force the banner open
  // (e.g. user clicked an Activity row that opens a theme accordion).
  // The MovablePanel watches this value and resets its local collapsed
  // state to false whenever the number changes, so navigation actions
  // always land on a visible accordion even if the user had collapsed
  // the panel a moment earlier. Optional so callers that don't need
  // imperative open can omit it.
  expandSignal?: number;
  // Mobile dock control — forwarded to the inner MovablePanel.
  mobileOpenOverride?: boolean;
  mobileTopOverridePx?: number;
  onMobileClose?: () => void;
  mobileDockAnchor?: { left: number; top: number; arrowOffset: number };
  forceDockMode?: boolean;
};

// Right-hand inspector — shows either the Selected Element controls
// (when something is selected) or the Current Tab controls (when not).
// Sat in the Palette before the split; lifted out so the Palette stays
// a compact strip of canvas-tool + shape primitives. Defaults to the
// bottom-right corner so it sits above the zoom controls.
export function ContextPanel({
  position,
  selection,
  selectionScope = 'single',
  tab,
  tabAccordionsOpen,
  setTabAccordionsOpen,
  onMoveTo,
  onReset,
  onSize,
  stackBelowY,
  expandSignal,
  mobileOpenOverride,
  mobileTopOverridePx,
  onMobileClose,
  mobileDockAnchor,
  forceDockMode,
}: ContextPanelProps) {
  // Accordion open state lives at the panel level so it survives the
  // SelectedElement <-> Tab swap whenever the user deselects or
  // switches elements. Without this lift, every selection change
  // collapsed the accordions and the user had to re-click in.
  const [selectedAccordionsOpen, setSelectedAccordionsOpen] = useState<SelectedAccordionState>(
    ALL_SELECTED_ACCORDIONS_CLOSED,
  );
  // Local fallback for the tab-section accordion when the caller
  // doesn't lift state. Same mutual-exclusion shape.
  const [localTabOpen, setLocalTabOpen] = useState<TabAccordionState>({
    text: false,
    theme: false,
    canvas: false,
    cleanup: false,
  });
  const tabOpen = tabAccordionsOpen ?? localTabOpen;
  const setTabOpen = setTabAccordionsOpen ?? setLocalTabOpen;

  // Track whichever accordion set is currently visible — when a
  // selection exists we render SelectedElementSection (5 accordions);
  // otherwise TabSection (2 accordions). `anyOpen` drives the idle
  // timer below.
  const showingSelected = selection !== null;
  const anyOpen = showingSelected
    ? Object.values(selectedAccordionsOpen).some(Boolean)
    : Object.values(tabOpen).some(Boolean);
  // `closeAll` resets only the visible accordion set — closing the
  // other one would be pointless work but also incorrect (it'd
  // collapse state the user left intentionally open from the other
  // mode).
  const closeAll = useCallback(() => {
    if (showingSelected) {
      setSelectedAccordionsOpen(ALL_SELECTED_ACCORDIONS_CLOSED);
    } else {
      setTabOpen({ text: false, theme: false, canvas: false, cleanup: false });
    }
  }, [showingSelected, setTabOpen]);

  const panelBodyRef = useRef<HTMLDivElement>(null);
  useAutoCloseAfterIdle(panelBodyRef, anyOpen, closeAll);

  // Stable reference to the visible body content avoids re-creating
  // listeners on unrelated re-renders.
  const body = useMemo(() => {
    return selection ? (
      <SelectedElementSection
        selection={selection}
        open={selectedAccordionsOpen}
        setOpen={setSelectedAccordionsOpen}
      />
    ) : (
      <TabSection tab={tab} open={tabOpen} setOpen={setTabOpen} />
    );
  }, [selection, selectedAccordionsOpen, tab, tabOpen, setTabOpen]);

  return (
    <MovablePanel
      title={
        selection === null
          ? 'Current Tab'
          : selectionScope === 'group'
            ? 'Selected Group'
            : selectionScope === 'multi'
              ? 'Selected Elements'
              : 'Selected Element'
      }
      position={position}
      defaultCorner="top-right-stacked"
      width="w-auto sm:w-64"
      stackBelowY={stackBelowY}
      onReset={onReset}
      onMoveTo={onMoveTo}
      onSize={onSize}
      collapsible
      expandSignal={expandSignal}
      mobileOpenOverride={mobileOpenOverride}
      mobileTopOverridePx={mobileTopOverridePx}
      onMobileClose={onMobileClose}
      mobileDockAnchor={mobileDockAnchor}
      forceDockMode={forceDockMode}
    >
      {/* Wrapper ref scopes the idle-timer listeners to the panel
          body — the MovablePanel's header (drag handle) doesn't
          count, so dragging the panel around won't reset the timer
          and accordions still collapse after 20 s of no body
          interaction. */}
      <div ref={panelBodyRef}>{body}</div>
    </MovablePanel>
  );
}
