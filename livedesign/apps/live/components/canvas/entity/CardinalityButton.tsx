'use client';

// A relationship's toolbar group (docs/specs/009-elements/entity.md "Cardinality ends"): the Cardinality
// button, labelled with the pair the ends say now, opening the presets that set both ends at once.
import {
  CARDINALITY_PRESETS,
  ER_GLYPHS,
  type CardinalityPreset,
  type ErShape,
} from '@livedesign/document';
import { Divider } from '@/components/canvas/SelectionPopoverButton';
import {
  noFocusSteal,
  ToolbarDropdown,
  type ToolbarDropdownMenuAnchor,
} from '@/components/rich-text/ToolbarDropdown';

export type CardinalityToolbar = {
  // The pair now (`1 : N`), or null when the ends are not ER ends.
  current: string | null;
  onPick: (preset: CardinalityPreset) => void;
};

const OPTION_ROW = 'flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left text-xs transition';
const OPTION_ON = 'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100';
const OPTION_OFF = 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800';

// One ER end in its 0..10 box, the table at x = 10 (er-heads.ts); `flip` puts the table on the left.
function End({ shape, x, flip }: { shape: ErShape; x: number; flip?: boolean }) {
  const g = ER_GLYPHS[shape];
  return (
    <g transform={flip ? `translate(${x + 10} 0) scale(-1 1)` : `translate(${x} 0)`}>
      {g.lines.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
      ))}
      {g.rings.map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} className="fill-white dark:fill-slate-900" />
      ))}
    </g>
  );
}

// The preset drawn as a line with its two ends, as it will look on the canvas.
function PresetGlyph({ preset }: { preset: CardinalityPreset }) {
  return (
    <svg
      aria-hidden
      width={46}
      height={12}
      viewBox="-1 0 48 10"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.1}
      strokeLinecap="round"
      className="shrink-0"
    >
      <line x1={10} y1={5} x2={36} y2={5} />
      <End shape={preset.start} x={0} flip />
      <End shape={preset.end} x={36} />
    </svg>
  );
}

export function CardinalityButton({
  current,
  onPick,
  menuAnchor,
}: CardinalityToolbar & { menuAnchor?: ToolbarDropdownMenuAnchor }) {
  return (
    <>
      <ToolbarDropdown
        label="Cardinality"
        description="How many on each side of this relationship: one to one, one to many, many to many and more."
        menuClassName="min-w-[14rem]"
        menuAnchor={menuAnchor}
        trigger={
          <span className="whitespace-nowrap px-1 font-mono text-[11px] font-semibold tracking-tight">
            {current ?? '1 : N'}
          </span>
        }
      >
        {CARDINALITY_PRESETS.map((preset) => {
          const on = current === preset.short;
          return (
            <button
              key={preset.id}
              type="button"
              role="option"
              aria-selected={on}
              onMouseDown={noFocusSteal}
              onClick={() => onPick(preset)}
              className={`${OPTION_ROW} ${on ? OPTION_ON : OPTION_OFF}`}
            >
              <PresetGlyph preset={preset} />
              <span className="flex-1">{preset.label}</span>
              <span className="font-mono text-[10px] opacity-60">{preset.short}</span>
            </button>
          );
        })}
      </ToolbarDropdown>
      <Divider />
    </>
  );
}
