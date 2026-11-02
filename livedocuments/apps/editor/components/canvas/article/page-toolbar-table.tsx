'use client';

// The page toolbar's Table menu (docs/specs/007-editor/article-pages.md "The page toolbar", "Tables"):
// shown while the caret or a cell selection is in a table, for someone who may reshape it. Rows above and
// below, columns left and right, deleting them, the header row and the table. An entry that cannot run
// now (a limit reached, the header row's place) is unavailable, its tooltip saying why.
import type { ReactNode } from 'react';
import {
  lucideBetweenHorizontalEnd,
  lucideBetweenHorizontalStart,
  lucideBetweenVerticalEnd,
  lucideBetweenVerticalStart,
  lucideColumns2,
  lucidePanelTop,
  lucideRows2,
  lucideTrash2,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph, Tooltip } from '@livedocuments/ui';
import type { TableCommandName } from '@/lib/article/article-table-commands';

const I = (glyph: Parameters<typeof lucideGlyph>[0]) => lucideGlyph(glyph, 16);
const Icons = {
  rowAbove: I(lucideBetweenHorizontalStart),
  rowBelow: I(lucideBetweenHorizontalEnd),
  colLeft: I(lucideBetweenVerticalStart),
  colRight: I(lucideBetweenVerticalEnd),
  deleteRow: I(lucideRows2),
  deleteCol: I(lucideColumns2),
  header: I(lucidePanelTop),
  deleteTable: I(lucideTrash2),
};

/** The Table menu's entries, in order, with a rule before each group after the first. */
export const TABLE_ENTRIES: readonly { id: TableCommandName; label: string; rule?: true }[] = [
  { id: 'rowAbove', label: 'Insert Row Above' },
  { id: 'rowBelow', label: 'Insert Row Below' },
  { id: 'colLeft', label: 'Insert Column Left', rule: true },
  { id: 'colRight', label: 'Insert Column Right' },
  { id: 'deleteRow', label: 'Delete Row', rule: true },
  { id: 'deleteCol', label: 'Delete Column' },
  { id: 'header', label: 'Header Row', rule: true },
  { id: 'deleteTable', label: 'Delete Table', rule: true },
];

function Entry({
  label,
  icon,
  blocked,
  pressed,
  danger,
  onPick,
}: {
  label: string;
  icon: ReactNode;
  blocked: string | null;
  pressed?: boolean;
  danger?: boolean;
  onPick: () => void;
}) {
  const row = (
    <button
      type="button"
      role={pressed === undefined ? 'menuitem' : 'menuitemcheckbox'}
      aria-checked={pressed}
      aria-disabled={blocked !== null || undefined}
      onClick={blocked === null ? onPick : undefined}
      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition focus-visible:outline-2 focus-visible:outline-brand-600 ${
        blocked !== null
          ? 'cursor-not-allowed text-slate-400 opacity-60 dark:text-slate-400'
          : danger
            ? 'cursor-pointer text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10'
            : 'cursor-pointer text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
      }`}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {pressed === undefined ? null : (
        <span
          aria-hidden
          className={`relative h-4 w-7 shrink-0 rounded-full transition ${
            pressed ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'
          }`}
        >
          <span
            className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-all ${
              pressed ? 'left-3.5' : 'left-0.5'
            }`}
          />
        </span>
      )}
    </button>
  );
  return blocked === null ? row : <Tooltip label={blocked}>{row}</Tooltip>;
}

export function TablePanel({
  header,
  blockedOf,
  onCommand,
}: {
  // Whether the table's header row is on.
  header: boolean;
  // Why an entry cannot run now, or null.
  blockedOf: (name: TableCommandName) => string | null;
  onCommand: (name: TableCommandName) => void;
}) {
  return (
    <div role="menu" aria-label="Table" className="flex flex-col">
      {TABLE_ENTRIES.map((e) => {
        const Glyph = Icons[e.id];
        return (
          <div key={e.id}>
            {e.rule ? <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" /> : null}
            <Entry
              label={e.label}
              icon={<Glyph />}
              blocked={blockedOf(e.id)}
              pressed={e.id === 'header' ? header : undefined}
              danger={e.id === 'deleteTable'}
              onPick={() => onCommand(e.id)}
            />
          </div>
        );
      })}
    </div>
  );
}
