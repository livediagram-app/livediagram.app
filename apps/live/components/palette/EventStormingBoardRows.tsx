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
  // Photo import (spec/139 Phase 8). Absent when the deployment has no model
  // key: the whole feature is then not a thing this board can do, and a
  // greyed row would advertise something the operator cannot switch on.
  onImportPhoto?: () => void;
  photoDisabled?: boolean;
  // Why it is disabled, when the reason is worth saying (a draft already open).
  photoDisabledReason?: string;
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
      {controls.onImportPhoto ? (
        <button
          type="button"
          onClick={controls.onImportPhoto}
          disabled={controls.photoDisabled}
          title={controls.photoDisabledReason}
          className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition ${
            controls.photoDisabled
              ? 'cursor-not-allowed opacity-50'
              : 'hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <CameraIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200">
              Add from photo
            </span>
            <span className="block text-[10px] leading-snug text-slate-500 dark:text-slate-400">
              Read the stickies off a photo of the wall
            </span>
          </span>
        </button>
      ) : null}
    </div>
  );
}

// A camera: the act is "photograph the wall", not "upload a file".
function CameraIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.1-1.8A1 1 0 0 1 8.7 4.7h6.6a1 1 0 0 1 .9.5L17.3 7h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
      <circle cx="12" cy="12.8" r="3.2" />
    </svg>
  );
}
