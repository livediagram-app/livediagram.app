import { useId, useMemo } from 'react';
import { MAX_PAGE_DEPTH, pageTreeRows } from '@liveknowledge/document';
import { PagesIcon } from '@/components/page-tree/page-tree-icons';
import type { ImportDestination } from '@/lib/knowledge-import/run-import';

/** A page of the open knowledgebase, as the picker needs it. */
export type DestinationPage = { id: string; name: string; parent?: string };

const OPTION =
  'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors duration-short pointer-coarse:min-h-11';
const OPTION_ON = 'border-brand-400 bg-brand-50/60 dark:border-brand-400 dark:bg-brand-500/10';
const OPTION_OFF =
  'border-slate-200 hover:border-brand-300 dark:border-slate-700 dark:hover:border-brand-500/60';
const RADIO = 'mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand-600';

// Where an import lands (docs/specs/020-import-export/knowledgebase-import.md "Where it lands"): a knowledgebase of
// its own, or under a page of this one, chosen from the page tree. Native radios, so the arrow keys move through
// each group and a screen reader says which of how many.
export function DestinationPicker({
  destination,
  pages,
  defaultPageId,
  newName,
  disabled,
  onChange,
}: {
  destination: ImportDestination;
  pages: readonly DestinationPage[];
  /** The page chosen when "Under a Page" is first picked: the open one. */
  defaultPageId: string;
  /** What a new knowledgebase will be called. */
  newName: string;
  disabled?: boolean;
  onChange: (destination: ImportDestination) => void;
}) {
  const name = useId();
  const rows = useMemo(() => pageTreeRows(pages), [pages]);
  const under = destination.kind === 'under';
  // A page at the last level takes no subpage.
  const firstOpen = () =>
    rows.find((r) => r.page.id === defaultPageId && r.depth < MAX_PAGE_DEPTH)?.page.id ??
    rows.find((r) => r.depth < MAX_PAGE_DEPTH)?.page.id;

  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="text-xs font-semibold text-slate-900 dark:text-slate-100">
        Where It Lands
      </legend>
      <div className="mt-2 space-y-2">
        <label className={`${OPTION} ${under ? OPTION_OFF : OPTION_ON}`}>
          <input
            type="radio"
            name={name}
            className={RADIO}
            checked={!under}
            onChange={() => onChange({ kind: 'new' })}
          />
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-slate-900 dark:text-slate-100">
              A New Knowledgebase
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-slate-600 [overflow-wrap:anywhere] dark:text-slate-300">
              Named {newName}. This Knowledgebase stays as it is.
            </span>
          </span>
        </label>
        <div className={`rounded-lg border ${under ? OPTION_ON : OPTION_OFF}`}>
          <label className="flex cursor-pointer items-start gap-2.5 px-3 py-2.5 pointer-coarse:min-h-11">
            <input
              type="radio"
              name={name}
              className={RADIO}
              checked={under}
              onChange={() => {
                const pageId = firstOpen();
                if (pageId) onChange({ kind: 'under', pageId });
              }}
            />
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-slate-900 dark:text-slate-100">
                Under a Page of This Knowledgebase
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-slate-600 dark:text-slate-300">
                The top pages of the import become its subpages.
              </span>
            </span>
          </label>
          {under ? (
            <div
              role="radiogroup"
              aria-label="Page to Import Under"
              className="mx-3 mb-3 max-h-40 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 dark:border-slate-700 dark:bg-slate-900"
            >
              {rows.map((row) => {
                const full = row.depth >= MAX_PAGE_DEPTH;
                return (
                  <label
                    key={row.page.id}
                    className={`flex min-h-8 items-center gap-2 pr-3 text-xs pointer-coarse:min-h-11 ${
                      full
                        ? 'cursor-not-allowed text-slate-400 dark:text-slate-400'
                        : 'cursor-pointer text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60'
                    } has-[:focus-visible]:bg-brand-50 dark:has-[:focus-visible]:bg-brand-500/10`}
                    style={{ paddingLeft: 12 + (row.depth - 1) * 16 }}
                  >
                    <input
                      type="radio"
                      name={`${name}-page`}
                      className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-brand-600 disabled:cursor-not-allowed"
                      checked={destination.kind === 'under' && destination.pageId === row.page.id}
                      disabled={full}
                      onChange={() => onChange({ kind: 'under', pageId: row.page.id })}
                    />
                    <span className="shrink-0 text-slate-400 dark:text-slate-400">
                      <PagesIcon size={14} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {row.page.name.trim() || 'Untitled Page'}
                    </span>
                    {/* A page at the last level takes no subpage: the row says why it cannot be chosen. */}
                    {full ? <span className="shrink-0 text-[11px]">Deepest Level</span> : null}
                  </label>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </fieldset>
  );
}
