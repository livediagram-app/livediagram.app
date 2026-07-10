import { useEffect, useState } from 'react';
import { Button } from '@livediagram/ui';
import type { LineSeries } from '@livediagram/diagram';
import { CloseIcon } from '@/components/primitives/CloseIcon';
import { Dialog } from '@/components/dialogs/Dialog';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { parseCsvLineData } from '@/lib/csv';

// Line-chart data editor in a modal (spec/53). The context menu's Data category
// only summarises the series + offers "Edit data", which opens this — the 2-D
// grid (a row per category, a column per series) is too wide for the narrow
// menu. A row per category (label + a value per series) with the series names
// along the top, add / remove either axis, and an Import CSV button. Commits
// the whole dataset live on each blur / structural change (one undo step), so
// the chart updates behind the modal.

export function LineDataDialog({
  categories,
  series,
  onCommit,
  onClose,
}: {
  categories: string[];
  series: LineSeries[];
  onCommit: (categories: string[], series: LineSeries[]) => void;
  onClose: () => void;
}) {
  const [cats, setCats] = useState<string[]>(categories);
  const [rows, setRows] = useState<LineSeries[]>(series);
  // Seed once on mount; the dialog owns the draft while open (re-seeding on
  // every external commit would fight the user's typing).
  useEffect(() => {
    setCats(categories);
    setRows(series);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const commit = (c: string[], s: LineSeries[]) => {
    setCats(c);
    setRows(s);
    onCommit(c, s);
  };
  const cell =
    'min-w-0 rounded border border-slate-200 bg-white px-1.5 py-1 text-sm text-slate-700 outline-none focus:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
  const xBtn =
    'flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 transition enabled:cursor-pointer enabled:hover:bg-rose-50 enabled:hover:text-rose-600 disabled:opacity-30 dark:enabled:hover:bg-rose-500/15';
  const addBtn =
    'inline-flex cursor-pointer items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15';

  const importCsv = (file: File) => {
    void file.text().then((text) => {
      const parsed = parseCsvLineData(text);
      if (parsed) commit(parsed.categories, parsed.series);
    });
  };

  return (
    <Dialog open onClose={onClose} ariaLabel="Edit chart data" size="xl" className="max-h-[90vh]">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 pt-6 pb-4 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Chart data</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            A row per category, a column per series. Or import a CSV (header = series names, first
            column = categories).
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <HelpArticleLink
            article="dataElements"
            title="Data elements"
            description="Charts and data-driven elements, and how to edit their data."
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <CloseIcon size={18} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 px-6 pt-4">
        <label className={`${addBtn} cursor-pointer`}>
          Import CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importCsv(f);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
        <table className="border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="w-28" />
              {rows.map((s, si) => (
                <th key={si} className="min-w-[7rem]">
                  <div className="flex items-center gap-1">
                    <input
                      className={`${cell} w-full font-medium`}
                      value={s.name}
                      aria-label="Series name"
                      onChange={(e) =>
                        setRows((r) =>
                          r.map((x, j) => (j === si ? { ...x, name: e.target.value } : x)),
                        )
                      }
                      onBlur={() => onCommit(cats, rows)}
                    />
                    <button
                      type="button"
                      aria-label="Remove series"
                      disabled={rows.length <= 1}
                      onClick={() =>
                        commit(
                          cats,
                          rows.filter((_, j) => j !== si),
                        )
                      }
                      className={xBtn}
                    >
                      ×
                    </button>
                  </div>
                </th>
              ))}
              <th className="w-8 align-bottom">
                <button
                  type="button"
                  aria-label="Add series"
                  onClick={() =>
                    commit(cats, [
                      ...rows,
                      { name: `Series ${rows.length + 1}`, values: cats.map(() => 0) },
                    ])
                  }
                  className={`${addBtn} h-8 w-8 !px-0`}
                >
                  +
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {cats.map((c, i) => (
              <tr key={i}>
                <td>
                  <input
                    className={`${cell} w-28`}
                    value={c}
                    aria-label="Category"
                    onChange={(e) =>
                      setCats((cc) => cc.map((v, j) => (j === i ? e.target.value : v)))
                    }
                    onBlur={() => onCommit(cats, rows)}
                  />
                </td>
                {rows.map((s, si) => (
                  <td key={si}>
                    <input
                      className={`${cell} w-full text-right tabular-nums`}
                      type="number"
                      value={s.values[i] ?? 0}
                      aria-label={`${s.name} ${c}`}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setRows((r) =>
                          r.map((x, j) =>
                            j === si
                              ? {
                                  ...x,
                                  values: x.values.map((v, k) =>
                                    k === i ? (Number.isFinite(n) ? n : 0) : v,
                                  ),
                                }
                              : x,
                          ),
                        );
                      }}
                      onBlur={() => onCommit(cats, rows)}
                    />
                  </td>
                ))}
                <td className="text-center">
                  <button
                    type="button"
                    aria-label="Remove row"
                    disabled={cats.length <= 1}
                    onClick={() =>
                      commit(
                        cats.filter((_, j) => j !== i),
                        rows.map((s) => ({ ...s, values: s.values.filter((_, k) => k !== i) })),
                      )
                    }
                    className={xBtn}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
        <button
          type="button"
          onClick={() =>
            commit(
              [...cats, `#${cats.length + 1}`],
              rows.map((s) => ({ ...s, values: [...s.values, 0] })),
            )
          }
          className={addBtn}
        >
          + Add row
        </button>
        <Button variant="primary" size="md" onClick={onClose}>
          Done
        </Button>
      </div>
    </Dialog>
  );
}
