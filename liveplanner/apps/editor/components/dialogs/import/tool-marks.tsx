// Each tool's mark in the Import dialog's A Board from Another Tool rows (docs/specs/026-plan/plan-tabs.md "The Import
// dialog"): a simple drawing that reads as the tool at a glance, white on the tool's own colour, never its logo file.
// Drawn here so the dialog's chunk carries four small paths and nothing is fetched.
import type { TrackerSource } from '@liveplanner/items';
import { Glyph } from '@liveplanner/ui';

// The tools' own brand colours, dark enough for a white mark on top in light and dark alike.
const TILE: Readonly<Record<TrackerSource, string>> = {
  trello: '#0C66E4',
  asana: '#E8534F',
  jira: '#1868DB',
  linear: '#5E6AD2',
};

function Marks({ source }: { source: TrackerSource }) {
  switch (source) {
    // Two lists on a board, the left one longer.
    case 'trello':
      return (
        <>
          <rect x="4.5" y="4.5" width="6.3" height="15" rx="1.6" />
          <rect x="13.2" y="4.5" width="6.3" height="9.4" rx="1.6" />
        </>
      );
    // Three dots, one over two.
    case 'asana':
      return (
        <>
          <circle cx="12" cy="7.2" r="3.8" />
          <circle cx="6.6" cy="15.9" r="3.8" />
          <circle cx="17.4" cy="15.9" r="3.8" />
        </>
      );
    // A diamond round a smaller one.
    case 'jira':
      return <path fillRule="evenodd" d="M12 3 21 12 12 21 3 12Zm0 5.6L8.6 12l3.4 3.4 3.4-3.4Z" />;
    // A disc cut by two diagonal strokes towards its lower left.
    case 'linear':
      return (
        <>
          <circle cx="12" cy="12" r="8.4" />
          <g stroke={TILE.linear} strokeWidth="1.5" strokeLinecap="round">
            <path d="M2.6 6.3 17.7 21.4" />
            <path d="M1.2 9.6 14.4 22.8" />
          </g>
        </>
      );
  }
}

// The mark on its tile, sized for an option row's icon slot.
export function ToolMark({ source }: { source: TrackerSource }) {
  return (
    <span
      className="flex h-8 w-8 items-center justify-center rounded-lg shadow-sm ring-1 ring-black/5 dark:ring-white/10"
      style={{ backgroundColor: TILE[source] }}
    >
      <Glyph filled size={20} units={24} className="text-white">
        <Marks source={source} />
      </Glyph>
    </span>
  );
}
