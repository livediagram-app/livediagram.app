// What the Import dialog's list offers (docs/specs/026-plan/plan-tabs.md "The Import dialog"): the tab's own import,
// then the four tools, each row's name, its file type and one line saying what file to bring and where it lives.
import type { ReactNode } from 'react';
import { TRACKER_SOURCE_NAMES, type TrackerSource } from '@liveplanner/items';
import { BrandMark, lucideGlyph } from '@liveplanner/ui';
import { lucideTable } from '@liveworkspace/icons/lucide';
import type { IntoTab } from './into-tab';
import { ToolMark } from './tool-marks';

export type ImportRowCopy = { label: string; file: 'JSON' | 'CSV'; hint: string; icon: ReactNode };

export const TOOL_ROWS: readonly (ImportRowCopy & { source: TrackerSource })[] = (
  [
    ['trello', 'JSON', 'Board JSON from Menu › Print, export and share › Export as JSON'],
    ['asana', 'CSV', 'Project CSV from its name menu › Export/Print › CSV'],
    ['jira', 'CSV', 'Issues CSV from Issue search › Export › Export CSV (all fields)'],
    ['linear', 'CSV', 'Issues CSV from Settings › Import / Export › Export CSV'],
  ] as const
).map(([source, file, hint]) => ({
  source,
  label: TRACKER_SOURCE_NAMES[source],
  file,
  hint,
  icon: <ToolMark source={source} />,
}));

export const TOOLS_NOTE = 'A one-off copy into a new Board tab or plan, after a preview.';

const CsvGlyph = lucideGlyph(lucideTable, 17);

// The tab's own icon tile: the liveplanner prism for its own JSON, a grid for a CSV.
function Tile({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/25">
      {children}
    </span>
  );
}

export function intoTabCopy(into: IntoTab): ImportRowCopy {
  if (into.kind === 'json')
    return {
      label: 'liveplanner Tab',
      file: 'JSON',
      hint: 'A tab’s JSON from Export. Replaces this tab.',
      icon: (
        <Tile>
          <BrandMark className="h-[18px] w-[18px]" />
        </Tile>
      ),
    };
  return {
    label: 'CSV',
    file: 'CSV',
    hint:
      into.target === 'board'
        ? 'A .csv or .tsv, each row a new card on this board'
        : 'A .csv or .tsv into this sheet’s cells',
    icon: (
      <Tile>
        <CsvGlyph />
      </Tile>
    ),
  };
}
