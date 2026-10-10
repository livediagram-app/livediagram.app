'use client';

import { track } from '@/lib/telemetry';
import type { ExplorerViewMode } from './useExplorerViewMode';
import { HoverCard, Glyph } from '@livediagram/ui';

// The List / Card / Details segmented toggle in the Explorer header
// (docs/specs/006-document/document-snapshots.md, docs/specs/013-workspace/explorer-details-view.md).
// Lets you switch how the browse views render the same folders +
// documents: dense rows, cards with a large SVG snapshot, or a sortable table.
const TOGGLE_TELEMETRY = {
  list: 'ExplorerViewList',
  card: 'ExplorerViewCard',
  details: 'ExplorerViewDetails',
} as const satisfies Record<ExplorerViewMode, string>;

export function ViewToggle({
  mode,
  onChange,
}: {
  mode: ExplorerViewMode;
  onChange: (mode: ExplorerViewMode) => void;
}) {
  // Track only real switches (docs/specs/017-telemetry/telemetry.md): clicking the already-active
  // side changes nothing, so it isn't a signal worth counting.
  const choose = (next: ExplorerViewMode) => {
    if (next !== mode) {
      track('UI', 'Toggled', TOGGLE_TELEMETRY[next]);
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
        description="Cards with a large preview of each document."
      >
        <GridIcon />
      </ToggleButton>
      <ToggleButton
        active={mode === 'details'}
        onClick={() => choose('details')}
        label="Details view"
        description="A sortable table: type, comments, access, size and dates."
      >
        <DetailsIcon />
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
    <HoverCard title={label} description={description}>
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
    </HoverCard>
  );
}

function ListIcon() {
  return (
    <Glyph size={15} units={16} strokeLinejoin="miter">
      <path d="M5 4h8M5 8h8M5 12h8" />
      <circle cx="2.5" cy="4" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="2.5" cy="8" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="2.5" cy="12" r="0.6" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

function GridIcon() {
  return (
    <Glyph size={15} units={16} strokeLinecap="butt">
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
    </Glyph>
  );
}

// A table: a header band over rows split into columns.
function DetailsIcon() {
  return (
    <Glyph size={15} units={16} strokeLinecap="butt">
      <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
      <path d="M2 6h12M2 9.5h12M6.5 6v7.5" />
    </Glyph>
  );
}
