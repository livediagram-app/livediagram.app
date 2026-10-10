'use client';

// The toolbar's Borders menu (docs/specs/029-sheets/sheet.md "Toolbar"): which borders, as a compact grid of drawn
// squares (the lines it sets in ink, the rest faint), then the line as drawn swatches (thin, medium, thick, dashed,
// dotted), the chosen one marked. Each is named by the shared tooltip and its accessible name.
import type { BorderMode, BorderStyle } from '@livediagram/sheets';
import { Glyph, Tooltip } from '@livediagram/ui';

export type BorderLine = { label: string; w: 1 | 2 | 3; s: BorderStyle };

export const BORDER_LINES: readonly BorderLine[] = [
  { label: 'Thin', w: 1, s: 'solid' },
  { label: 'Medium', w: 2, s: 'solid' },
  { label: 'Thick', w: 3, s: 'solid' },
  { label: 'Dashed', w: 1, s: 'dashed' },
  { label: 'Dotted', w: 1, s: 'dotted' },
];

const MODES: readonly { mode: BorderMode; label: string }[] = [
  { mode: 'all', label: 'All Borders' },
  { mode: 'inner', label: 'Inner Borders' },
  { mode: 'outer', label: 'Outer Borders' },
  { mode: 'none', label: 'No Borders' },
  { mode: 'top', label: 'Top Border' },
  { mode: 'bottom', label: 'Bottom Border' },
  { mode: 'left', label: 'Left Border' },
  { mode: 'right', label: 'Right Border' },
];

// A 2 x 2 cell square: each of its twelve half-lines drawn in ink when the mode sets it, else faint and dashed.
function BorderGlyph({ mode }: { mode: BorderMode }) {
  const outer = mode === 'all' || mode === 'outer';
  const inner = mode === 'all' || mode === 'inner';
  const lines: { d: string; on: boolean }[] = [
    { d: 'M3 3H17', on: outer || mode === 'top' },
    { d: 'M3 17H17', on: outer || mode === 'bottom' },
    { d: 'M3 3V17', on: outer || mode === 'left' },
    { d: 'M17 3V17', on: outer || mode === 'right' },
    { d: 'M10 3V17', on: inner },
    { d: 'M3 10H17', on: inner },
  ];
  return (
    <Glyph size={18} units={20}>
      {lines.map((l) =>
        l.on ? null : (
          <path
            key={l.d}
            d={l.d}
            stroke="currentColor"
            strokeOpacity={0.3}
            strokeWidth={1}
            strokeDasharray="1.5 1.5"
          />
        ),
      )}
      {lines.map((l) =>
        l.on ? <path key={l.d} d={l.d} stroke="currentColor" strokeWidth={1.75} /> : null,
      )}
    </Glyph>
  );
}

// A line as it will draw.
function LineSwatch({ line }: { line: BorderLine }) {
  const dash = line.s === 'dashed' ? '5 3' : line.s === 'dotted' ? '1 3' : undefined;
  return (
    <Glyph size={22} units={24}>
      <path
        d="M2 12H22"
        stroke="currentColor"
        strokeWidth={line.w === 1 ? 1.25 : line.w === 2 ? 2.25 : 3.5}
        strokeDasharray={dash}
        strokeLinecap={line.s === 'dotted' ? 'round' : 'butt'}
      />
    </Glyph>
  );
}

const CELL =
  'flex cursor-pointer items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50';

export function SheetBordersPicker({
  line,
  onLine,
  onPick,
}: {
  line: BorderLine;
  onLine: (line: BorderLine) => void;
  onPick: (mode: BorderMode) => void;
}) {
  return (
    <div className="flex w-[11.5rem] flex-col gap-2 p-2">
      <div role="group" aria-label="Borders" className="grid grid-cols-4 gap-1">
        {MODES.map((m) => (
          <Tooltip key={m.mode} label={m.label}>
            <button
              type="button"
              role="menuitem"
              aria-label={m.label}
              className={`${CELL} h-9 w-full`}
              onClick={() => onPick(m.mode)}
            >
              <BorderGlyph mode={m.mode} />
            </button>
          </Tooltip>
        ))}
      </div>
      <div className="h-px bg-slate-200 dark:bg-slate-700" />
      <div role="radiogroup" aria-label="Line" className="grid grid-cols-5 gap-1">
        {BORDER_LINES.map((l) => {
          const on = l.label === line.label;
          return (
            <Tooltip key={l.label} label={l.label}>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={on}
                aria-label={l.label}
                className={`${CELL} h-8 w-full ${
                  on ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200' : ''
                }`}
                onClick={() => onLine(l)}
              >
                <LineSwatch line={l} />
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
