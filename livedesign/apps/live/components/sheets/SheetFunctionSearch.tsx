'use client';

// The toolbar's Search (docs/specs/029-sheets/sheet.md "Toolbar"): a field over every function the engine knows,
// matched by name, then by what it does. Picking one hands its family and name back: the toolbar switches to
// Functions, opens that family's menu and highlights the function there for a moment (SheetFunctionMenu).
import { useMemo, useState } from 'react';
import { NoMatches, TextInput } from '@livedesign/ui';
import { FUNCTION_DOCS, FUNCTION_FAMILIES, type FunctionFamily } from '@livedesign/sheets';
import { PortalMenu } from '@/components/primitives/PortalMenu';
import { useMenuItemProps } from '@/components/primitives/menu-item-props';
import { FUNCTION_FAMILY_LABELS } from './SheetFunctionMenu';
import { FUNCTION_FAMILY_ICONS } from './sheet-icons';

// How many matches show: the list scrolls, but a one-letter query should not draw hundreds of rows.
export const FUNCTION_SEARCH_MAX = 40;

export type FunctionMatch = { name: string; family: FunctionFamily };

const EVERY: readonly FunctionMatch[] = FUNCTION_FAMILIES.flatMap(([family, fns]) =>
  Object.keys(fns).map((name) => ({ name, family })),
).sort((a, b) => a.name.localeCompare(b.name));

// The functions `query` finds: names starting with it, then names holding it, then those whose summary does; at
// most FUNCTION_SEARCH_MAX. Empty finds nothing.
export function searchFunctions(query: string): FunctionMatch[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts: FunctionMatch[] = [];
  const holds: FunctionMatch[] = [];
  const says: FunctionMatch[] = [];
  for (const m of EVERY) {
    const name = m.name.toLowerCase();
    if (name.startsWith(q)) starts.push(m);
    else if (name.includes(q)) holds.push(m);
    else if (FUNCTION_DOCS[m.name]?.summary.toLowerCase().includes(q)) says.push(m);
  }
  return [...starts, ...holds, ...says].slice(0, FUNCTION_SEARCH_MAX);
}

function MatchRow({ match, onPick }: { match: FunctionMatch; onPick: () => void }) {
  const { itemProps } = useMenuItemProps();
  const Icon = FUNCTION_FAMILY_ICONS[match.family];
  const doc = FUNCTION_DOCS[match.name];
  return (
    <button
      type="button"
      {...itemProps}
      aria-label={`${match.name}, ${FUNCTION_FAMILY_LABELS[match.family]}`}
      onClick={onPick}
      className="flex w-full min-w-0 cursor-pointer items-start gap-2 px-3 py-1.5 text-left transition hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800"
    >
      <span aria-hidden className="mt-0.5 flex shrink-0 text-slate-500 [&_svg]:size-4">
        <Icon />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-mono text-[12px] font-semibold text-slate-800 dark:text-slate-100">
          {match.name}
          <span className="ml-1.5 font-sans font-normal text-slate-500 dark:text-slate-400">
            {FUNCTION_FAMILY_LABELS[match.family]}
          </span>
        </span>
        {doc?.summary ? (
          <span className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
            {doc.summary}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function SheetFunctionSearch({
  anchor,
  onPick,
  onClose,
}: {
  anchor: HTMLElement;
  onPick: (match: FunctionMatch) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => searchFunctions(query), [query]);
  return (
    <PortalMenu anchor={anchor} onClose={onClose} surface="control" label="Search Functions" wide>
      <div className="flex flex-col gap-1 p-2">
        <TextInput
          autoFocus
          compact
          type="search"
          aria-label="Search functions"
          placeholder="Search functions"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // The Enter is spent here: unhandled, it would press the function the menu then focuses.
            if (e.key === 'Enter' && matches[0]) {
              e.preventDefault();
              e.stopPropagation();
              onPick(matches[0]);
            }
          }}
        />
        {query.trim() ? (
          matches.length ? (
            <div className="-mx-2 max-h-72 overflow-y-auto overscroll-contain">
              {matches.map((m) => (
                <MatchRow key={m.name} match={m} onPick={() => onPick(m)} />
              ))}
            </div>
          ) : (
            <NoMatches things="functions" query={query} hint="Try what it does, like “average”." />
          )
        ) : (
          <p className="px-1 py-2 text-[12px] text-slate-500 dark:text-slate-400">
            Type a function’s name, or what it does.
          </p>
        )}
      </div>
    </PortalMenu>
  );
}
