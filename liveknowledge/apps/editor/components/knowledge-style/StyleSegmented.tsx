'use client';

// A choice of a few, as the editor's other segmented controls draw one (the shared track and sliding pill): a
// radiogroup whose arrow keys move the choice, each option at least 44 px tall on a phone.
import { ACTIVE_SEGMENT, SEGMENT_TRACK } from '@liveknowledge/ui';
import { SegmentSlider } from '@liveworkspace/workbench/components/primitives/SegmentSlider';

export function StyleSegmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  const index = options.findIndex(([id]) => id === value);
  // The arrows move the choice and the focus with it.
  const move = (group: HTMLElement, by: number) => {
    const to = (index + by + options.length) % options.length;
    const next = options[to];
    if (!next) return;
    onChange(next[0]);
    group.querySelectorAll<HTMLElement>('[role="radio"]')[to]?.focus();
  };
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[12px] font-medium text-slate-600 dark:text-slate-300">{label}</p>
      <div
        role="radiogroup"
        aria-label={label}
        className={`relative grid rounded-lg p-0.5 ${SEGMENT_TRACK}`}
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            move(e.currentTarget, 1);
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            move(e.currentTarget, -1);
          }
        }}
      >
        <SegmentSlider count={options.length} index={index} className={ACTIVE_SEGMENT} />
        {options.map(([id, text]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={value === id}
            // One stop in the tab order, on the choice in force; the arrows move it.
            tabIndex={value === id ? 0 : -1}
            onClick={() => onChange(id)}
            className={`relative z-10 cursor-pointer rounded-md px-2 py-1.5 text-[13px] font-semibold transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 max-sm:min-h-11 ${
              value === id
                ? 'text-white'
                : 'text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-100'
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
