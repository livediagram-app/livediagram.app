'use client';

import { Tooltip } from '@/components/primitives/Tooltip';
import { track } from '@/lib/telemetry';
import type { ExplorerViewMode } from './useExplorerViewMode';

// The List / Card segmented toggle in the Explorer header (spec/67).
// Lets you switch how the browse views render the same folders +
// diagrams: dense rows, or cards with a large SVG snapshot.
export function ViewToggle({
  mode,
  onChange,
}: {
  mode: ExplorerViewMode;
  onChange: (mode: ExplorerViewMode) => void;
}) {
  // Track only real switches (spec/22): clicking the already-active
  // side changes nothing, so it isn't a signal worth counting.
  const choose = (next: ExplorerViewMode) => {
    if (next !== mode) {
      track('UI', 'Toggled', next === 'card' ? 'ExplorerViewCard' : 'ExplorerViewList');
    }
    onChange(next);
  };
  return (
    <div
      role="group"
      aria-label="View mode"
      className="flex items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800"
    >
      <ToggleButton
        active={mode === 'list'}
        onClick={() => choose('list')}
        label="List view"
        description="Compact rows."
      >
        <ListIcon />
      </ToggleButton>
      <ToggleButton
        active={mode === 'card'}
        onClick={() => choose('card')}
        label="Card view"
        description="Cards with a large preview of each diagram."
      >
        <GridIcon />
      </ToggleButton>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
  description,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip title={label} description={description}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={active}
        className={
          'flex h-7 w-7 items-center justify-center rounded transition ' +
          (active
            ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-700 dark:text-brand-300'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200')
        }
      >
        {children}
      </button>
    </Tooltip>
  );
}

function ListIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M5 4h8M5 8h8M5 12h8" />
      <circle cx="2.5" cy="4" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="2.5" cy="8" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="2.5" cy="12" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
    </svg>
  );
}
