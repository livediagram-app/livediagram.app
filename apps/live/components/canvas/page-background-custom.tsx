'use client';

// The Background section's custom gradient editor (docs/specs/007-editor/illustrate-pages.md
// "Backgrounds"): From and To, each a swatch button opening the one colour picker
// (docs/specs/004-interface-design/colour-picker.md), the Angle, and Swap. Each previews while
// changed and commits once.
import { useState } from 'react';
import type { PageFill } from '@livediagram/document';
import { MenuSliderRow } from '@/components/primitives/MenuSliderRow';
import { ColourSwatchButton } from '@/components/colour/ColourSwatchButton';
import { standardOptions, type ColourGroup } from '@/components/colour/colour-options';
import { useDocumentColours } from '@/hooks/ui/useDocumentColours';

// The gradient Angle slider's step, in degrees.
const ANGLE_STEP = 5;

// A page's colours: the soft standard colours, then the strong ones, for light paper (a page is
// designed on light paper; its stored colours are light-paper hexes).
export const PAGE_COLOUR_GROUPS: readonly ColourGroup[] = [
  { heading: 'Light', options: standardOptions('soft', 'light', 'hex') },
  { heading: 'Dark', options: standardOptions('strong', 'light', 'hex') },
];

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
  const yours = useDocumentColours();
  const well = (end: 'from' | 'to', label: string) => (
    <span className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
      <ColourSwatchButton
        label={`Gradient ${label.toLowerCase()} colour`}
        swatch={fill[end]}
        value={fill[end]}
        standard={PAGE_COLOUR_GROUPS}
        yours={yours}
        onPick={(hex) => onCommit({ ...fill, [end]: hex })}
        onPreview={(hex) => onPreview({ ...fill, [end]: hex })}
        onPreviewEnd={onPreviewEnd}
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
