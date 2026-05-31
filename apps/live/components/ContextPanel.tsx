'use client';

import { useState } from 'react';
import {
  SelectedElementSection,
  TabSection,
  type SelectedAccordionState,
  type SelectedElementControls,
  type TabAccordionState,
  type TabSectionControls,
} from './CommandPalette';
import { MovablePanel } from './MovablePanel';

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
      {selection ? (
        <SelectedElementSection
          selection={selection}
          open={selectedAccordionsOpen}
          setOpen={setSelectedAccordionsOpen}
          scope={selectionScope}
        />
      ) : (
        <TabSection tab={tab} open={tabOpen} setOpen={setTabOpen} />
      )}
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
