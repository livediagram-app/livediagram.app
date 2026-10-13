'use client';

// A labelled slider that previews while it moves and commits the value it is let go at, so a
// drag is one undo step (the Wordmark sliders, the Text Size slider). Without `onPreview` it only
// commits on the let-go: the thumb and readout still follow the drag from local state.
import { useState, type ReactNode } from 'react';
import { MenuSliderRow } from '@/components/primitives/MenuSliderRow';

export function PreviewSliderRow({
  label,
  min,
  max,
  step,
  value,
  format,
  restDisplay,
  valueText,
  ticks,
  onPreview,
  onCommit,
  onPreviewEnd,
  action,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format: (v: number) => string;
  // The readout at rest when it is not the value's own (a size that is Scale, or Mixed).
  restDisplay?: string;
  valueText?: (v: number) => string;
  ticks?: readonly number[];
  onPreview?: (v: number) => void;
  onCommit: (v: number) => void;
  // Ends the preview without a change (a drag let go where it began).
  onPreviewEnd?: () => void;
  action?: ReactNode;
}) {
  // The drag under way: where it started and where it is; null at rest (the element's own value
  // shows). The start is kept because the preview writes the live element as the thumb moves, so by
  // the let-go `value` already equals where the drag ended.
  const [drag, setDrag] = useState<{ from: number; at: number } | null>(null);
  const shown = drag?.at ?? value;
  const commit = () => {
    if (drag === null) return;
    setDrag(null);
    if (drag.at !== drag.from) onCommit(drag.at);
    // Back where it began: nothing to commit, but the preview it opened must close, or its stale
    // snapshot would stand in for the element's state on the next style change.
    else onPreviewEnd?.();
  };
  const display = drag === null && restDisplay !== undefined ? restDisplay : format(shown);
  return (
    <MenuSliderRow
      label={label}
      min={min}
      max={max}
      step={step}
      value={shown}
      display={display}
      valueText={valueText ? valueText(shown) : `${label} ${display}`}
      ticks={ticks}
      onChange={(v) => {
        setDrag((d) => ({ from: d?.from ?? value, at: v }));
        onPreview?.(v);
      }}
      onRelease={commit}
      action={action}
    />
  );
}

// The quiet text button a slider row carries at its label's end (Flat on the Arc, Scale on Text Size).
export function SliderRowAction({
  label,
  active,
  onClick,
  onPointerEnter,
  onPointerLeave,
}: {
  label: string;
  // A toggle's state; leave unset for a one-shot action.
  active?: boolean;
  onClick: () => void;
  onPointerEnter?: (e: React.PointerEvent) => void;
  onPointerLeave?: (e: React.PointerEvent) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className={`rounded px-1 text-[10px] font-semibold transition ${
        active
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
          : 'text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10'
      }`}
    >
      {label}
    </button>
  );
}
