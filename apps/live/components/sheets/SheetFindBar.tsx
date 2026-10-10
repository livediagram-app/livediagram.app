'use client';

// Find and Replace (docs/specs/029-sheets/sheet.md "Find"): a small bar on the sheet's top right; matches counted and
// stepped through with Enter and Shift+Enter, in values (and, asked, in inputs), Match Case and Match Entire Cell;
// Replace and Replace All in inputs only. Escape closes it.
import { Button, Tooltip } from '@livediagram/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { findMatches, replaceAll, type FindOptions } from '@livediagram/sheets';
import { track } from '@/lib/telemetry';
import { useSheetController } from './sheet-controller';
import { useSheetActions } from './useSheetActions';
import { HEADER_PX } from './SheetHeader';

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
const FIND_HIGHLIGHTS_MAX = 2_000;

export function SheetFindBar() {
  const c = useSheetController();
  const actions = useSheetActions();
  const [query, setQuery] = useState('');
  const [by, setBy] = useState('');
  const [opts, setOpts] = useState<FindOptions>({});
  // The match shown, once Enter or an arrow has gone to one (the first Enter goes to the first match).
  const [at, setAt] = useState<number | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const replace = c.findOpen === 'replace';
  useEffect(() => {
    track('Sheet', 'Opened', 'Find');
    input.current?.focus();
  }, []);
  const matches = useMemo(
    () => findMatches(c.workbook, c.sheet.id, query, opts),
    // Found again whenever a value may have changed (`version`), not only when the query does.
    [c.workbook, c.sheet.id, query, opts, c.version], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Every match is highlighted while Find is open (the first FIND_HIGHLIGHTS_MAX of them).
  const { setFindHits } = c;
  useEffect(() => {
    setFindHits(query ? matches.slice(0, FIND_HIGHLIGHTS_MAX) : []);
  }, [matches, query, setFindHits]);
  useEffect(() => () => setFindHits([]), [setFindHits]);
  const go = (i: number) => {
    if (!matches.length) return;
    const k = ((i % matches.length) + matches.length) % matches.length;
    setAt(k);
    const m = matches[k]!;
    actions.goTo({ r1: m.r, c1: m.c, r2: m.r, c2: m.c });
  };
  const step = (by: 1 | -1) => go(at === null ? (by === 1 ? 0 : -1) : at + by);
  const close = () => {
    c.setFindOpen(null);
    c.focusGrid();
  };
  const toggle = (k: keyof FindOptions, label: string) => (
    <label className="flex cursor-pointer items-center gap-1">
      <input
        type="checkbox"
        checked={!!opts[k]}
        onChange={(e) => setOpts({ ...opts, [k]: e.target.checked })}
      />
      {label}
    </label>
  );
  const field = 'h-7 rounded-md border bg-transparent px-2 text-[12px] outline-none';
  return (
    <div
      role="search"
      data-keeps-escape
      aria-label="Find in sheet"
      className="absolute right-2 z-30 w-80 rounded-lg border p-2 text-[12px] shadow-lg"
      style={{
        top: HEADER_PX + 6,
        backgroundColor: c.palette.surface,
        borderColor: c.palette.border,
        color: c.palette.text,
      }}
      onPointerDown={stop}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') close();
      }}
    >
      <div className="flex items-center gap-1.5">
        <input
          ref={input}
          aria-label="Find"
          placeholder="Find"
          className={`${field} min-w-0 flex-1`}
          style={{ borderColor: c.palette.border }}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setAt(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') step(e.shiftKey ? -1 : 1);
          }}
        />
        <span className="w-16 text-right tabular-nums" style={{ color: c.palette.muted }}>
          {query
            ? matches.length
              ? `${at === null ? 0 : at + 1} of ${matches.length}`
              : 'No matches'
            : ''}
        </span>
        <Tooltip label="Previous Match">
          <button
            type="button"
            aria-label="Previous Match"
            className="h-7 w-6 cursor-pointer rounded hover:bg-black/5"
            onClick={() => step(-1)}
          >
            ↑
          </button>
        </Tooltip>
        <Tooltip label="Next Match">
          <button
            type="button"
            aria-label="Next Match"
            className="h-7 w-6 cursor-pointer rounded hover:bg-black/5"
            onClick={() => step(1)}
          >
            ↓
          </button>
        </Tooltip>
        <Tooltip label="Close Find">
          <button
            type="button"
            aria-label="Close Find"
            className="h-7 w-6 cursor-pointer rounded hover:bg-black/5"
            onClick={close}
          >
            ✕
          </button>
        </Tooltip>
      </div>
      {replace ? (
        <div className="mt-1.5 flex items-center gap-1.5">
          <input
            aria-label="Replace with"
            placeholder="Replace with"
            className={`${field} min-w-0 flex-1`}
            style={{ borderColor: c.palette.border }}
            value={by}
            onChange={(e) => setBy(e.target.value)}
          />
          <button
            type="button"
            className="h-7 cursor-pointer rounded-md px-2 hover:bg-black/5"
            onClick={() => {
              const m = at === null ? undefined : matches[at];
              if (!m) return step(1);
              const r = replaceAll(c.workbook, c.sheet.id, query, by, opts);
              const one = r.cells.find(
                (ch) => ch.r === c.sheet.layout.rows[m.r] && ch.c === c.sheet.layout.cols[m.c],
              );
              // A match only in a value worked out by a formula has nothing typed to replace: on to the next one.
              if (!one) return step(1);
              c.write({ kind: 'cells', cells: [one] }, 'Replace');
              // On to the next match: in the list as it will be once this one no longer matches, at the same place.
              const rest = matches.filter((x) => x !== m);
              if (!rest.length) return setAt(null);
              const k = at! % rest.length;
              setAt(k);
              actions.goTo({ r1: rest[k]!.r, c1: rest[k]!.c, r2: rest[k]!.r, c2: rest[k]!.c });
            }}
          >
            Replace
          </button>
          <Button
            variant="primary"
            size="xs"

            onClick={() => {
              const r = replaceAll(c.workbook, c.sheet.id, query, by, opts);
              if (r.count) c.write({ kind: 'cells', cells: r.cells }, 'Replace');
              c.notify(`Replaced ${r.count} cell${r.count === 1 ? '' : 's'}`);
            }}
          >
            Replace All
          </Button>
        </div>
      ) : null}
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1" style={{ color: c.palette.muted }}>
        {toggle('matchCase', 'Match Case')}
        {toggle('entireCell', 'Match Entire Cell')}
        {toggle('inFormulas', 'Also Search Formulas')}
      </div>
    </div>
  );
}
