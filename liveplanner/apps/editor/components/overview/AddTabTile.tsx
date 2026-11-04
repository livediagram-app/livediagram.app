import { Tooltip, lucideGlyph } from '@liveplanner/ui';
import {
  lucideClipboardList,
  lucideGrid3x3,
  lucideLayoutGrid,
  lucideSquareKanban,
} from '@liveworkspace/icons/lucide';
import type { StartCategory } from '@/components/plan/start/start-planning-items';
import { AddTile } from './OverviewSection';

// The kinds a new tab can start as straight away, each opening the new tab's Start Planning on its category, with the
// rail's own icons (StartPlanning RAIL_ICONS).
export const ADD_TAB_KINDS: readonly {
  start: StartCategory;
  name: string;
  Icon: ReturnType<typeof lucideGlyph>;
}[] = [
  { start: 'boards', name: 'Board', Icon: lucideGlyph(lucideSquareKanban, 16) },
  { start: 'sheets', name: 'Sheet', Icon: lucideGlyph(lucideGrid3x3, 16) },
  { start: 'dashboards', name: 'Dashboard', Icon: lucideGlyph(lucideLayoutGrid, 16) },
  { start: 'forms', name: 'Form', Icon: lucideGlyph(lucideClipboardList, 16) },
];

// The Tabs grid's last tile (docs/specs/026-plan/plan-overview.md "Tabs"): Add Tab, the size of a tab's tile (its 16:10
// preview over a name row), and under it a chip per kind that starts one directly.
export function AddTabTile({ onAdd }: { onAdd: (start?: StartCategory) => void }) {
  return (
    <AddTile
      label="Add Tab"
      hint="Board, Sheet, Dashboard or Form"
      onClick={() => onAdd()}
      face="aspect-[16/10]"
      below={
        <div
          role="group"
          aria-label="Start a Tab As"
          className="flex h-11 shrink-0 items-center justify-center gap-1 border-t border-dashed border-slate-200 dark:border-slate-700/80"
        >
          {ADD_TAB_KINDS.map(({ start, name, Icon }) => (
            <Tooltip key={start} label={`Add a ${name}`}>
              <button
                type="button"
                aria-label={`Add a ${name}`}
                data-add-tab-kind={start}
                onClick={() => onAdd(start)}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-brand-700 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-brand-300"
              >
                <Icon />
              </button>
            </Tooltip>
          ))}
        </div>
      }
    />
  );
}
