'use client';

import { useState } from 'react';
import {
  SelectedElementSection,
  TabSection,
  type SelectedAccordionState,
  type SelectedElementControls,
  type TabSectionControls,
} from './CommandPalette';
import { MovablePanel } from './MovablePanel';

type ContextPanelProps = {
  position: { x: number; y: number } | null;
  minimized: boolean;
  size: { width: number; height: number } | null;
  selection: SelectedElementControls | null;
  tab: TabSectionControls;
  onMoveTo: (x: number, y: number) => void;
  onToggleMinimized: () => void;
  onResize: (size: { width: number; height: number }) => void;
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
  size,
  selection,
  tab,
  onMoveTo,
  onToggleMinimized,
  onResize,
  onReset,
}: ContextPanelProps) {
  // Accordion open state lives at the panel level so it survives the
  // SelectedElement <-> Tab swap whenever the user deselects or
  // switches elements. Without this lift, every selection change
  // collapsed the accordions and the user had to re-click in.
  const [selectedAccordionsOpen, setSelectedAccordionsOpen] = useState<SelectedAccordionState>({
    shape: false,
    appearance: false,
    layer: false,
    text: false,
    colours: false,
    pointer: false,
  });
  if (minimized) return null;
  return (
    <MovablePanel
      title="Editor"
      position={position}
      defaultCorner="top-right-stacked"
      width="w-64"
      size={size}
      minWidth={220}
      minHeight={260}
      onResize={onResize}
      onReset={onReset}
      onMoveTo={onMoveTo}
      onMinimize={onToggleMinimized}
    >
      {selection ? (
        <SelectedElementSection
          selection={selection}
          open={selectedAccordionsOpen}
          setOpen={setSelectedAccordionsOpen}
        />
      ) : (
        <TabSection tab={tab} />
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
