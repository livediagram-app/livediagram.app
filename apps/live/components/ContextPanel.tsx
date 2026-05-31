'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
  minimized: boolean;
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
  onToggleMinimized: () => void;
  onReset: () => void;
};

// Right-hand inspector — shows either the Selected Element controls
// (when something is selected) or the Current Tab controls (when not).
// Sat in the Palette before the split; lifted out so the Palette stays
// a compact strip of canvas-tool + shape primitives. Defaults to the
// bottom-right corner so it sits above the zoom controls.
export function ContextPanel({
  position,
  minimized,
  selection,
  selectionScope = 'single',
  tab,
  tabAccordionsOpen,
  setTabAccordionsOpen,
  onMoveTo,
  onToggleMinimized,
  onReset,
}: ContextPanelProps) {
  // Accordion open state lives at the panel level so it survives the
  // SelectedElement <-> Tab swap whenever the user deselects or
  // switches elements. Without this lift, every selection change
  // collapsed the accordions and the user had to re-click in.
  const [selectedAccordionsOpen, setSelectedAccordionsOpen] = useState<SelectedAccordionState>({
    shape: false,
    layer: false,
    text: false,
    colours: false,
    pointer: false,
  });
  // Local fallback for the tab-section accordion when the caller
  // doesn't lift state. Same mutual-exclusion shape.
  const [localTabOpen, setLocalTabOpen] = useState<TabAccordionState>({
    theme: false,
    canvas: false,
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
      setSelectedAccordionsOpen({
        shape: false,
        layer: false,
        text: false,
        colours: false,
        pointer: false,
      });
    } else {
      setTabOpen({ theme: false, canvas: false });
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
        scope={selectionScope}
      />
    ) : (
      <TabSection tab={tab} open={tabOpen} setOpen={setTabOpen} />
    );
  }, [selection, selectedAccordionsOpen, tab, tabOpen, setTabOpen, selectionScope]);

  if (minimized) return null;
  return (
    <MovablePanel
      title="Editor"
      position={position}
      defaultCorner="top-right-stacked"
      width="w-64"
      onReset={onReset}
      onMoveTo={onMoveTo}
      onMinimize={onToggleMinimized}
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

// Icon used by the dock button when the Context panel is minimised.
// Lines + a focus dot — reads as "the thing you've focused on".
export function ContextIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3.5" y="3.5" width="13" height="13" rx="2" />
      <path d="M7 8.5h6M7 12h4" />
    </svg>
  );
}
