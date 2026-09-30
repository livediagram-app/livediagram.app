'use client';

// More shapes (docs/specs/023-whiteboard/whiteboard.md "What a whiteboard shows"): a search field,
// focused as the flyout opens, over a grid of the catalogue's shape previews in the board's ink.
// An empty field shows every shape, grouped as in the palette; typing ranks the best match first.
// Fixed width and a fixed-height results area, so the flyout never resizes as results change.

import { useEffect, useId } from 'react';
import { SearchInput } from '@/components/primitives/SearchInput';
import type { WhiteboardShapeKey } from '@/lib/whiteboard-shape-catalogue';
import { FlyoutHeading } from './WhiteboardFlyout';
import { ShapePreview } from './ShapePreview';
import { useShapeSearch } from './useShapeSearch';

export function ShapeSearch({
  ink,
  onPick,
}: {
  ink: string;
  onPick: (key: WhiteboardShapeKey) => void;
}) {
  const base = useId();
  const listboxId = `${base}-results`;
  const optionId = (key: string) => `${base}-${key}`;
  const { query, setQuery, view, flat, active, setActive, onKeyDown } = useShapeSearch(onPick);
  const current = flat[active];
  const activeId = current ? optionId(current.key) : undefined;

  useEffect(() => {
    if (!activeId) return;
    document.getElementById(activeId)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeId]);

  let index = 0;
  return (
    <div data-shape-search="" className="flex w-[16.5rem] flex-col gap-2">
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search shapes"
        ariaLabel="Search shapes"
        clearAriaLabel="Clear the shape search"
        clearDescription="Clear the shape search."
        onKeyDown={onKeyDown}
        activeDescendantId={activeId}
        listboxId={listboxId}
      />
      <div
        id={listboxId}
        role="listbox"
        aria-label="Shapes"
        className="h-60 overflow-y-auto overscroll-contain pr-0.5"
      >
        {view.groups.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
            No shapes match
          </p>
        ) : (
          view.groups.map((group) => (
            <div
              key={group.id}
              role="group"
              aria-labelledby={view.searching ? undefined : `${base}-g-${group.id}`}
              aria-label={view.searching ? 'Matches' : undefined}
              className="mb-2 last:mb-0"
            >
              {view.searching ? null : (
                <FlyoutHeading className="mb-1">
                  <span id={`${base}-g-${group.id}`}>{group.label}</span>
                </FlyoutHeading>
              )}
              <div className="grid grid-cols-6 gap-1">
                {group.entries.map((entry) => {
                  const at = index++;
                  const selected = at === active;
                  return (
                    <div
                      key={entry.key}
                      id={optionId(entry.key)}
                      role="option"
                      aria-selected={selected}
                      aria-label={entry.label}
                      data-shape-option={entry.key}
                      // Focus stays in the field; a press picks.
                      onPointerDown={(e) => e.preventDefault()}
                      onPointerMove={() => (selected ? undefined : setActive(at))}
                      onClick={() => onPick(entry.key)}
                      className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg transition hover:bg-slate-100 dark:hover:bg-slate-800 ${
                        selected ? 'bg-brand-50 ring-2 ring-brand-500 dark:bg-brand-500/15' : ''
                      }`}
                    >
                      <ShapePreview entry={entry} colour={ink} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
      {/* The reached shape's name: the grid shows pictures, and the arrows need a word. */}
      <p
        aria-hidden
        data-shape-search-name=""
        className="h-4 truncate text-xs text-slate-600 dark:text-slate-300"
      >
        {current?.label ?? ''}
      </p>
    </div>
  );
}
