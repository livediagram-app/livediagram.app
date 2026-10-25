'use client';

// The photo chrome's small controls (docs/specs/031-photo/photo-pages.md "The options flyout"): a slider
// that shows its value and takes typing, a toggle and a choice, each labelled for a screen reader,
// at the strip's height.
import { Select, SwitchChip } from '@livedesign/ui';
import { SliderRow } from './flyout-controls';

const LABEL = 'shrink-0 text-[11px] font-medium text-slate-500 dark:text-slate-400';

/** A number with its name, its value typed straight in, and a slider filled to it: the options flyout's own row
 *  (flyout-controls SliderRow), so every photo slider (dialogs, panels, the flyout) looks and works alike. */
export function OptionSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  scale = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  // What the readout shows per unit of value (a 0 to 1 option read out as a percent: 100).
  scale?: number;
  onChange: (value: number) => void;
  // Kept for its callers: the row fills its container.
  width?: string;
}) {
  return (
    <SliderRow
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      unit={unit}
      scale={scale}
      onChange={onChange}
    />
  );
}

export function OptionToggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <SwitchChip
      checked={on}
      onChange={onChange}
      className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-medium ${
        on
          ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/50 dark:bg-brand-500/15 dark:text-brand-200'
          : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
      }`}
    >
      {label}
    </SwitchChip>
  );
}

export function OptionChoice<T extends string | number>({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: T;
  choices: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className={LABEL}>{label}</span>
      <Select
        size="sm"
        aria-label={label}
        value={String(value)}
        onChange={(e) => {
          const hit = choices.find((c) => String(c.value) === e.target.value);
          if (hit) onChange(hit.value);
        }}
      >
        {choices.map((c) => (
          <option key={String(c.value)} value={String(c.value)}>
            {c.label}
          </option>
        ))}
      </Select>
    </label>
  );
}
