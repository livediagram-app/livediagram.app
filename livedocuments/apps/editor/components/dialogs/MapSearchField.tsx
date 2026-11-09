'use client';

// A search box with its matches beneath (docs/specs/009-elements/map.md "The Map dialog"): Add Country and
// Find a Place. A combobox: ArrowUp / ArrowDown walk the matches, Enter picks the walked one (or the
// first), Escape clears the text before it closes the dialog. Matches come from the loaded geometry
// only, so nothing is fetched as you type.

import { useId, useState, type KeyboardEvent } from 'react';
import { TextInput } from '@livedocuments/ui';
import type { MapGeometry } from '@livedocuments/document';

export type MapSearchRow = {
  id: string;
  label: string;
  detail?: string;
  lat?: number;
  lon?: number;
};

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Starts-with matches first, then anywhere in the name.
function ranked<T>(items: readonly T[], q: string, name: (t: T) => string): T[] {
  const needle = fold(q.trim());
  if (!needle) return [];
  const starts: T[] = [];
  const inside: T[] = [];
  for (const t of items) {
    const n = fold(name(t));
    if (n.startsWith(needle)) starts.push(t);
    else if (n.includes(needle)) inside.push(t);
  }
  return [...starts, ...inside];
}

/** Countries by name, a code typed whole ("FR") first. */
export function matchCountries(geometry: MapGeometry | null, q: string): MapSearchRow[] {
  const rows = geometry?.countries ?? [];
  const code = q.trim().toUpperCase();
  const exact = rows.filter((c) => c[0] === code);
  const named = ranked(rows, q, (c) => c[1]).filter((c) => c[0] !== code);
  return [...exact, ...named].map((c) => ({ id: c[0], label: c[1] }));
}

export function matchPlaces(
  geometry: MapGeometry | null,
  q: string,
  countryName: (code: string) => string,
): MapSearchRow[] {
  return ranked(geometry?.places ?? [], q, (p) => p[0]).map((p, i) => ({
    id: `${p[0]}:${i}`,
    label: p[0],
    detail: p[1] ? countryName(p[1]) : undefined,
    lat: p[2],
    lon: p[3],
  }));
}

export function MapSearchField({
  label,
  placeholder,
  disabled,
  search,
  onPick,
}: {
  label: string;
  placeholder: string;
  disabled?: boolean;
  search: (q: string) => MapSearchRow[];
  onPick: (id: string, row: MapSearchRow) => void;
}) {
  const [q, setQ] = useState('');
  const [walk, setWalk] = useState(0);
  const listId = useId();
  const rows = q.trim() ? search(q) : [];
  const pick = (row: MapSearchRow) => {
    onPick(row.id, row);
    setQ('');
    setWalk(0);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && rows.length) {
      e.preventDefault();
      setWalk((w) => (w + 1) % rows.length);
    } else if (e.key === 'ArrowUp' && rows.length) {
      e.preventDefault();
      setWalk((w) => (w - 1 + rows.length) % rows.length);
    } else if (e.key === 'Enter' && rows.length) {
      e.preventDefault();
      pick(rows[Math.min(walk, rows.length - 1)]!);
    } else if (e.key === 'Escape' && q) {
      e.stopPropagation();
      setQ('');
    }
  };
  return (
    <div className="relative">
      <TextInput
        compact
        role="combobox"
        aria-label={label}
        aria-expanded={rows.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          rows.length ? `${listId}-${Math.min(walk, rows.length - 1)}` : undefined
        }
        title={disabled ? `${label}: the limit is reached` : label}
        placeholder={placeholder}
        disabled={disabled}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setWalk(0);
        }}
        onKeyDown={onKeyDown}
        className="w-full"
      />
      {rows.length ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={`${label} matches`}
          className="mt-1 max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-sm dark:border-slate-700 dark:bg-slate-800"
        >
          {rows.map((row, i) => (
            <li
              key={row.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === walk}
              onPointerDown={(e) => {
                e.preventDefault();
                pick(row);
              }}
              onPointerEnter={() => setWalk(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-2 px-3 py-1.5 text-[13px] ${
                i === walk
                  ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-100'
                  : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              <span className="truncate">{row.label}</span>
              {row.detail ? (
                <span className="shrink-0 truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {row.detail}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
