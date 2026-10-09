'use client';

// The Background section's custom choices (docs/specs/007-editor/illustrate-pages.md
// "Backgrounds"): a colour well opening the in-app colour picker in the panel, and the custom
// gradient's editor (From, To, Angle, Swap). Each previews while changed and commits once.
import { useState, type ReactNode } from 'react';
import type { PageFill } from '@livediagram/document';
import { MenuSliderRow } from '@/components/primitives/MenuSliderRow';
import { CustomColourEditor } from './whiteboard/CustomColourEditor';

// The gradient Angle slider's step, in degrees.
const ANGLE_STEP = 5;

/** A custom colour's well: a swatch of the colour that opens the in-app picker below it
 *  (InlineColourPicker), pressed while open. */
export function ColourWellButton({
  label,
  colour,
  open,
  onToggle,
  className = 'h-6 w-6',
  children,
}: {
  // The well's accessible name.
  label: string;
  colour: string;
  open: boolean;
  onToggle: () => void;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={open}
      onClick={onToggle}
      className={`relative shrink-0 rounded-full ring-1 ring-inset ring-slate-900/10 transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-brand-600 motion-reduce:hover:scale-100 dark:ring-white/15 ${
        open ? 'outline outline-2 outline-offset-2 outline-brand-500' : ''
      } ${className}`}
      style={{ background: colour }}
    >
      {children}
    </button>
  );
}

/** The in-app colour picker, in the panel under its well: each change previews on the page, Use
 *  commits it and closes, and Escape or the well again closes it and drops the preview. In the
 *  panel, so nothing about it is outside the section (the system picker was: closing it by
 *  clicking away closed the panel before its change arrived). */
export function InlineColourPicker({
  start,
  onPreview,
  onUse,
  onCancel,
}: {
  start: string;
  onPreview: (hex: string) => void;
  onUse: (hex: string) => void;
  onCancel: () => void;
}) {
  return (
    <div
      data-inline-colour-picker=""
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        // The picker's Escape, not the panel's.
        e.stopPropagation();
        onCancel();
      }}
    >
      <CustomColourEditor start={start} boardWarning={false} onPreview={onPreview} onUse={onUse} />
    </div>
  );
}

// The custom gradient's editor: From and To, the Angle, and Swap.
export function CustomGradientEditor({
  fill,
  onPreview,
  onPreviewEnd,
  onCommit,
}: {
  fill: Extract<PageFill, { kind: 'gradient' }>;
  onPreview: (fill: PageFill) => void;
  // Drops the preview (a colour picked and cancelled).
  onPreviewEnd: () => void;
  onCommit: (fill: PageFill) => void;
}) {
  // The angle while the slider is dragged; committed once on release.
  const [dragAngle, setDragAngle] = useState<number | null>(null);
  const angle = dragAngle ?? fill.angle;
  // The end whose colour is being picked.
  const [editing, setEditing] = useState<'from' | 'to' | null>(null);
  const well = (end: 'from' | 'to', label: string) => (
    <span className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
      <ColourWellButton
        label={`Gradient ${label.toLowerCase()} colour`}
        colour={fill[end]}
        open={editing === end}
        onToggle={() => {
          if (editing === end) onPreviewEnd();
          setEditing(editing === end ? null : end);
        }}
      />
      {label}
    </span>
  );
  return (
    <div
      data-custom-gradient=""
      className="mt-2 flex flex-col gap-1.5 rounded-lg border border-slate-200 p-2 dark:border-slate-700"
    >
      <div className="flex items-center gap-3">
        {well('from', 'From')}
        {well('to', 'To')}
        <button
          type="button"
          onClick={() => onCommit({ ...fill, from: fill.to, to: fill.from })}
          className="ml-auto rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Swap
        </button>
      </div>
      {editing ? (
        <InlineColourPicker
          key={editing}
          start={fill[editing]}
          onPreview={(hex) => onPreview({ ...fill, [editing]: hex })}
          onUse={(hex) => {
            onCommit({ ...fill, [editing]: hex });
            setEditing(null);
          }}
          onCancel={() => {
            onPreviewEnd();
            setEditing(null);
          }}
        />
      ) : null}
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
