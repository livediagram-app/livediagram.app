'use client';

// The one Text Size control (docs/specs/004-interface-design/fonts.md "Text size"): a slider of
// whole px from TEXT_PX_MIN to TEXT_PX_MAX with labelled breakpoints, and a Scale icon toggle to
// its right. Every place a
// label's size is chosen uses it: an element's Text flyout (single and multi selection), an
// arrow's caption, a table cell, a chart key and a Legend, a Sankey's labels, and the tab's size
// for new text. The slider previews as it moves and commits once when let go, so a drag is one
// undo step.
import {
  arrowLabelFontSize,
  CELL_FONT_PX,
  clampTextPx,
  labelFontPx,
  TEXT_PX_MAX,
  TEXT_PX_MIN,
  type TextSize,
  type TextSizePreset,
} from '@livedocuments/document';
import { onMouseHover } from '@liveworkspace/workbench/components/primitives/hover-preview';
import { Tooltip } from '@livedocuments/ui';
import { PreviewSliderRow } from '@/components/primitives/PreviewSliderRow';
import { ScaleIcon } from './palette-icons';
import { TOOLBAR_CONTROL_REST } from '@/components/chrome/toolbar-surface';

/**
 * The slider's labelled breakpoints: the ends, then every 12 px from 12. Five labels, because the
 * track in a menu flyout is only ~110px wide and eight crowded into one run of digits.
 */
export const TEXT_SIZE_TICKS: readonly number[] = [6, 12, 24, 36, 48];

/** The px a size draws at on this control's surface, where it is not already a px. */
export type PresetPx = (preset: TextSizePreset) => number;

/**
 * The scale an element's label presets draw on, for the control that sizes it: an arrow's caption,
 * a table's cells and a sticky note's writing each run their own; every other label the single-line
 * scale.
 */
export function presetPxFor(type: string): PresetPx {
  if (type === 'arrow') return arrowLabelFontSize;
  if (type === 'table') return (p) => CELL_FONT_PX[p];
  return (p) => labelFontPx(p, type === 'sticky');
}

/**
 * Where the thumb sits for a stored size. A px is itself; a preset (an element sized before the
 * slider, or a template's) sits at the px it draws at here, clamped into the range; Scale and
 * Mixed sit at Medium's px.
 */
export function textSizeThumbPx(size: TextSize | null, presetPx: PresetPx): number {
  if (typeof size === 'number') return clampTextPx(size);
  if (size === null || size === 'scale') return clampTextPx(presetPx('md'));
  return clampTextPx(presetPx(size));
}

/** The readout at rest: Scale, Mixed, or the px the size draws at. */
export function textSizeReadout(size: TextSize | null, presetPx: PresetPx): string {
  if (size === null) return 'Mixed';
  if (size === 'scale') return 'Scale';
  return `${typeof size === 'number' ? size : presetPx(size)}px`;
}

export function TextSizeControl({
  current,
  onSet,
  onPreview,
  onPreviewEnd,
  presetPx = (p) => labelFontPx(p),
  withScale = true,
  label = 'Text Size',
}: {
  // null = mixed (a multi-selection whose sizes differ): the readout says so.
  current: TextSize | null;
  onSet: (size: TextSize) => void;
  // Optional hover / drag preview: the menus wire it, the table cell and the tab dialog do not.
  onPreview?: (size: TextSize) => void;
  onPreviewEnd?: () => void;
  // The px each preset draws at on this surface (a note's label, an arrow's caption, a table
  // cell and a chart key each have their own scale), for the thumb and readout of a preset.
  presetPx?: PresetPx;
  // Off where there is nothing to fit text to: a chart key, a Legend, a Sankey's labels.
  withScale?: boolean;
  label?: string;
}) {
  const isScale = current === 'scale';
  return (
    <PreviewSliderRow
      label={label}
      min={TEXT_PX_MIN}
      max={TEXT_PX_MAX}
      step={1}
      value={textSizeThumbPx(current, presetPx)}
      format={(v) => `${v}px`}
      restDisplay={textSizeReadout(current, presetPx)}
      valueText={(v) => `${v} pixels`}
      ticks={TEXT_SIZE_TICKS}
      onPreview={onPreview}
      onCommit={(v) => onSet(clampTextPx(v))}
      onPreviewEnd={onPreviewEnd}
      trailing={
        withScale ? (
          <Tooltip label="Scale">
            <button
              type="button"
              aria-label="Scale"
              aria-pressed={isScale}
              onClick={() => onSet('scale')}
              onPointerEnter={onPreview ? onMouseHover(() => onPreview('scale')) : undefined}
              onPointerLeave={onPreviewEnd ? onMouseHover(onPreviewEnd) : undefined}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition ${
                isScale
                  ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
                  : TOOLBAR_CONTROL_REST
              }`}
            >
              <ScaleIcon />
            </button>
          </Tooltip>
        ) : undefined
      }
    />
  );
}
