'use client';

import { SettingsToggleRow } from '@/components/panels/SettingsToggleRow';

// The BOARD-level controls at the top of the palette's Event Storming category
// (spec/139). Everything below them adds a note; these change what the board
// itself does, so they sit above the notation with a rule under them rather
// than pretending to be a ninth sticky.
//
// Only rendered on an event-storming board: the category still exists
// elsewhere (a note kind can be favourited, spec/78), and a board switch shown
// on an ordinary diagram would be a switch for nothing.

export type EsBoardControls = {
  // Timeline lanes (spec/139 Phase 6).
  lanesOn: boolean;
  lanesDisabled: boolean;
  onToggleLanes: () => void;
};

export function EventStormingBoardRows({ controls }: { controls: EsBoardControls }) {
  return (
    <div className="mb-1.5 border-b border-slate-200 pb-1.5 dark:border-slate-700">
      <SettingsToggleRow
        label="Timeline lanes"
        hint="Snap notes into rows and half-note columns"
        checked={controls.lanesOn}
        disabled={controls.lanesDisabled}
        onToggle={controls.onToggleLanes}
      />
    </div>
  );
}
