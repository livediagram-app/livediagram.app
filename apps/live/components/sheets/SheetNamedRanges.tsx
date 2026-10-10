'use client';

// Sheet Settings' Named Ranges (docs/specs/029-sheets/sheet.md "Named ranges"): each name with its range, Go To
// (selects it) and, for someone who may edit, Remove (one undo step). Names are made in the name box.
import { CloseIcon, Tooltip } from '@livediagram/ui';
import { formatRange, posRangeOf } from '@livediagram/sheets';
import { useSheetController } from './sheet-controller';
import type { SheetActions } from './useSheetActions';

export const NO_NAMES = 'No named ranges yet. Select cells and type a name in the name box.';

export function SheetNamedRanges({
  actions,
  onClose,
}: {
  actions: SheetActions;
  onClose: () => void;
}) {
  const c = useSheetController();
  const layout = c.sheet.layout;
  const names = [...(layout.names ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  if (!names.length)
    return (
      <p className="px-0.5 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
        {NO_NAMES}
      </p>
    );
  return (
    <ul aria-label="Named ranges" className="flex flex-col gap-1">
      {names.map((x) => {
        const at = posRangeOf(layout, x);
        return (
          <li
            key={x.name}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-1 pl-2.5 pr-1 dark:border-slate-700 dark:bg-slate-800"
          >
            <span className="min-w-0 flex-1 truncate font-mono text-[12px] font-semibold text-slate-800 dark:text-slate-100">
              {x.name}
            </span>
            <span className="shrink-0 font-mono text-[11px] text-slate-500 dark:text-slate-400">
              {at ? formatRange(at) : ''}
            </span>
            {at ? (
              <button
                type="button"
                aria-label={`Go To ${x.name}`}
                className="shrink-0 cursor-pointer rounded-md px-1.5 py-0.5 text-[11px] font-medium text-brand-700 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
                onClick={() => {
                  actions.goTo(at);
                  onClose();
                  c.focusGrid();
                }}
              >
                Go To
              </button>
            ) : null}
            {c.canEdit ? (
              <Tooltip label={`Remove ${x.name}`}>
                <button
                  type="button"
                  aria-label={`Remove ${x.name}`}
                  className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                  onClick={() =>
                    c.write(
                      { kind: 'layout', changes: [{ k: 'name', name: x.name, range: null }] },
                      'Name',
                    )
                  }
                >
                  <CloseIcon size={11} />
                </button>
              </Tooltip>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
