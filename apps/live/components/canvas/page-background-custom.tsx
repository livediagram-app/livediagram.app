'use client';

// The Background section's custom choices (docs/specs/007-editor/illustrate-pages.md
// "Backgrounds"): the system colour picker behind a swatch, and the custom gradient's editor (From,
// To, Angle, Swap). Each previews while dragged and commits once.
import { useEffect, useRef, useState } from 'react';
import type { PageFill } from '@livediagram/document';
import { MenuSliderRow } from '@/components/primitives/MenuSliderRow';
import { hexish } from '@/components/palette/palette-controls';

// The gradient Angle slider's step, in degrees.
const ANGLE_STEP = 5;

// A colour well: the system colour picker behind a swatch of the colour, with its name.
function ColourWell({
  label,
  colour,
  onPreview,
  onCommit,
}: {
  label: string;
  colour: string;
  onPreview: (colour: string) => void;
  onCommit: (colour: string) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
      <span
        className="relative h-6 w-6 shrink-0 rounded-full ring-1 ring-inset ring-slate-900/10 dark:ring-white/15"
        style={{ background: colour }}
      >
        <CustomColourInput
          key={hexish(colour)}
          label={`Gradient ${label.toLowerCase()} colour`}
          value={hexish(colour)}
          onPreview={onPreview}
          onCommit={onCommit}
        />
      </span>
      {label}
    </label>
  );
}

// The custom gradient's editor: From and To, the Angle, and Swap.
export function CustomGradientEditor({
  fill,
  onPreview,
  onCommit,
}: {
  fill: Extract<PageFill, { kind: 'gradient' }>;
  onPreview: (fill: PageFill) => void;
  onCommit: (fill: PageFill) => void;
}) {
  // The angle while the slider is dragged; committed once on release.
  const [dragAngle, setDragAngle] = useState<number | null>(null);
  const angle = dragAngle ?? fill.angle;
  return (
    <div
      data-custom-gradient=""
      className="mt-2 flex flex-col gap-1.5 rounded-lg border border-slate-200 p-2 dark:border-slate-700"
    >
      <div className="flex items-center gap-3">
        <ColourWell
          label="From"
          colour={fill.from}
          onPreview={(from) => onPreview({ ...fill, from })}
          onCommit={(from) => onCommit({ ...fill, from })}
        />
        <ColourWell
          label="To"
          colour={fill.to}
          onPreview={(to) => onPreview({ ...fill, to })}
          onCommit={(to) => onCommit({ ...fill, to })}
        />
        <button
          type="button"
          onClick={() => onCommit({ ...fill, from: fill.to, to: fill.from })}
          className="ml-auto rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Swap
        </button>
      </div>
      <MenuSliderRow
        label="Angle"
        min={0}
        max={360 - ANGLE_STEP}
        step={ANGLE_STEP}
        value={angle}
        display={`${angle}°`}
        valueText={`${angle} degrees`}
        onChange={(a) => {
          setDragAngle(a);
          onPreview({ ...fill, angle: a });
        }}
        onRelease={() => {
          if (dragAngle !== null && dragAngle !== fill.angle)
            onCommit({ ...fill, angle: dragAngle });
          setDragAngle(null);
        }}
      />
    </div>
  );
}

// The system colour picker: previews as the colour is dragged (`input`), commits once when the
// picker settles (the native `change`, which React's onChange does not wait for), so a drag is one
// edit, not one per tick.
export function CustomColourInput({
  label,
  value,
  onPreview,
  onCommit,
}: {
  label: string;
  value: string;
  onPreview: (color: string) => void;
  onCommit: (color: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const commit = useRef(onCommit);
  useEffect(() => {
    commit.current = onCommit;
  });
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    const onChange = () => commit.current(el.value);
    el.addEventListener('change', onChange);
    return () => el.removeEventListener('change', onChange);
  }, []);
  return (
    <input
      ref={input}
      type="color"
      aria-label={label}
      defaultValue={value}
      onInput={(e) => onPreview(e.currentTarget.value)}
      className="absolute h-0 w-0 opacity-0"
    />
  );
}
