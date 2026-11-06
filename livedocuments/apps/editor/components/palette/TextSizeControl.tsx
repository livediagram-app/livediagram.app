'use client';

// The one Text Size control (docs/specs/004-interface-design/fonts.md "Text size"): a slider of
// whole px with labelled breakpoints, and a Scale icon toggle to its right. A text's or a shape's
// runs a document's 24 to 72 px ("In livedocuments"); a note's, a caption's, a cell's and a key's
// the model's 6 to 48. Every place a
// label's size is chosen uses it: an element's Text flyout (single and multi selection), an
// arrow's caption, a table cell, a chart key and a Legend, a Sankey's labels, and the tab's size
// for new text. The slider previews as it moves and commits once when let go, so a drag is one
// undo step.
import {
  arrowLabelFontSize,
  CELL_FONT_PX,
  DOCUMENT_TEXT_PX_MAX,
  DOCUMENT_TEXT_PX_MIN,
  labelFontPx,
  TEXT_PX_MAX,
  TEXT_PX_MIN,
  type TextPxRange,
  type TextSize,
  type TextSizePreset,
} from '@livedocuments/document';
import { onMouseHover } from '@liveworkspace/workbench/components/primitives/hover-preview';
import { Tooltip } from '@livedocuments/ui';
import { PreviewSliderRow } from '@liveworkspace/workbench/components/primitives/PreviewSliderRow';
import { ScaleIcon } from './palette-icons';
import { TOOLBAR_CONTROL_REST } from '@/components/chrome/toolbar-surface';

/**
 * The slider's labelled breakpoints: the ends, then every 12 px from 12. Five labels, because the
 * track in a menu flyout is only ~110px wide and eight crowded into one run of digits.
 */
export const TEXT_SIZE_TICKS: readonly number[] = [6, 12, 24, 36, 48];
/** A document's breakpoints: the ends, then every 12 px between. */
export const DOCUMENT_TEXT_SIZE_TICKS: readonly number[] = [24, 36, 48, 60, 72];

/** The model's range, every product's: a note, an arrow's caption, a table cell, a chart key, a Legend. */
export const MODEL_TEXT_PX: TextPxRange = { min: TEXT_PX_MIN, max: TEXT_PX_MAX };

/** The breakpoints for a range: a document's, or the model's. */
export function textSizeTicks(range: TextPxRange): readonly number[] {
  return range.min === DOCUMENT_TEXT_PX_MIN && range.max === DOCUMENT_TEXT_PX_MAX
    ? DOCUMENT_TEXT_SIZE_TICKS
    : TEXT_SIZE_TICKS;
}

/** A slider value made a whole px in its range. */
export function clampToRange(px: number, range: TextPxRange): number {
  if (!Number.isFinite(px)) return range.min;
  return Math.min(range.max, Math.max(range.min, Math.round(px)));
}

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
 * slider, or a template's) sits at the px it draws at here; Scale and Mixed sit at Medium's px.
 * Either way clamped into the range: only the thumb is, never the stored size, so a 14 px text in a
 * document keeps drawing at 14 px with the thumb at the slider's 24.
 */
export function textSizeThumbPx(
  size: TextSize | null,
  presetPx: PresetPx,
  range: TextPxRange = MODEL_TEXT_PX,
): number {
  if (typeof size === 'number') return clampToRange(size, range);
  if (size === null || size === 'scale') return clampToRange(presetPx('md'), range);
  return clampToRange(presetPx(size), range);
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
  range = MODEL_TEXT_PX,
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
  // The slider's px range: textPxRangeFor(type) for an element's label, a document's for the tab's
  // size for new text, the model's elsewhere.
  range?: TextPxRange;
}) {
  const isScale = current === 'scale';
  return (
    <PreviewSliderRow
      label={label}
      min={range.min}
      max={range.max}
      step={1}
      value={textSizeThumbPx(current, presetPx, range)}
      format={(v) => `${v}px`}
      restDisplay={textSizeReadout(current, presetPx)}
      valueText={(v) => `${v} pixels`}
      ticks={textSizeTicks(range)}
      onPreview={onPreview}
      onCommit={(v) => onSet(clampToRange(v, range))}
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
