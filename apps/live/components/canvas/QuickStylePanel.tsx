'use client';

// The quick style panel (docs/specs/008-canvas/quick-style-panel.md): the few most-used style choices for
// the selected shapes and arrows, on the right edge of the canvas. The context
// menu stays the complete home of every setting; this is the fast path to a
// handful of them, and never grows into the old Editor panel.

import { useRef, type PointerEvent } from 'react';
import { BorderStrokeIcon, BorderStyleIcon } from '@/components/palette/palette-icons';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { useQuickStylePlacement } from '@/hooks/ui/useQuickStylePlacement';
import {
  QUICK_ICON_ALIGNS,
  QUICK_TEXT_ALIGNS,
  QUICK_WIDTHS,
  type QuickIconAlign,
  type QuickStrokeStyle,
  type QuickStyleView,
  type QuickSwatchValue,
  type QuickWidth,
} from '@/lib/quick-style';
import type { QuickStyleApi } from '@/hooks/canvas/useQuickStyle';
import type { QuickSwatch, TextAlignX } from '@livediagram/diagram';
import {
  ClearStylesGlyph,
  FlowingLineGlyph,
  IconAlignGlyph,
  QuickRadioRow,
  TextAlignGlyph,
  type QuickOption,
} from './quick-style-rows';

const WIDTH_NAMES: Record<QuickWidth, string> = { thin: 'Thin', medium: 'Medium', thick: 'Thick' };
const STYLE_NAMES: Record<QuickStrokeStyle, string> = {
  solid: 'Solid',
  dashed: 'Dashed',
  dotted: 'Dotted',
  flowing: 'Flowing',
};
const TEXT_ALIGN_NAMES: Record<TextAlignX, string> = {
  left: 'Align left',
  center: 'Align centre',
  right: 'Align right',
};
const ICON_ALIGN_NAMES: Record<QuickIconAlign, string> = {
  left: 'Icon before label',
  above: 'Icon above label',
  right: 'Icon after label',
};

const swatchOptions = (swatches: QuickSwatch[]): QuickOption<number>[] =>
  swatches.map((s) => ({ value: s.slot, name: s.name, content: null, swatch: s.color }));

// Pressing inside the panel must never reach the canvas: no marquee, no pan,
// no deselect, no tab menu.
const stop = (e: PointerEvent | React.MouseEvent) => e.stopPropagation();

export function QuickStylePanel({
  quickStyle,
  hidden,
  showTitles = true,
}: {
  quickStyle: QuickStyleApi;
  // Zen, embeds, presenting, or a context menu open: the panel stands down.
  hidden: boolean;
  // Power user mode may hide the section titles; the rows keep their names.
  showTitles?: boolean;
}) {
  const isMobile = useIsMobileViewport();
  const { view } = quickStyle;
  const active = !hidden && !isMobile && view !== null;
  const panelRef = useRef<HTMLDivElement>(null);
  const spot = useQuickStylePlacement(panelRef, active);
  if (!active) return null;

  return (
    <div
      ref={panelRef}
      role="region"
      aria-label="Quick style"
      data-quick-style-panel=""
      data-testid="quick-style-panel"
      onPointerDown={stop}
      onDoubleClick={stop}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={
        spot
          ? { left: spot.left, top: spot.top }
          : // Measured before paint; hidden until then so it never flashes
            // in the wrong spot.
            { left: 0, top: 0, visibility: 'hidden' }
      }
      className="pointer-events-auto fixed z-[var(--z-panel)] flex w-52 flex-col gap-2.5 rounded-lg border border-slate-200 bg-white p-2 shadow-lg shadow-slate-900/5 motion-safe:animate-fade-in dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40"
    >
      <QuickStyleSections view={view} quickStyle={quickStyle} showTitles={showTitles} />
      <div className="flex flex-col gap-1 border-t border-slate-200 pt-2 dark:border-slate-800">
        {showTitles ? (
          <span
            aria-hidden
            className="select-none px-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
          >
            Actions
          </span>
        ) : null}
        <div role="group" aria-label="Actions">
          <button
            type="button"
            onClick={quickStyle.clearStyles}
            data-testid="quick-style-clear"
            className="flex h-7 w-full items-center justify-center gap-1.5 rounded-md text-xs font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ClearStylesGlyph />
            Clear styles
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickStyleSections({
  view,
  quickStyle,
  showTitles,
}: {
  view: QuickStyleView;
  quickStyle: QuickStyleApi;
  showTitles: boolean;
}) {
  const { stroke, background, width, style, textAlign, iconAlign } = view.sections;
  return (
    <>
      {stroke ? (
        <QuickRadioRow
          title="Stroke"
          testId="quick-style-stroke"
          showTitle={showTitles}
          options={swatchOptions(stroke.swatches)}
          value={stroke.value}
          onChoose={(slot) => quickStyle.setStroke(slot as QuickSwatchValue)}
        />
      ) : null}
      {background ? (
        <QuickRadioRow
          title="Background"
          testId="quick-style-background"
          showTitle={showTitles}
          options={swatchOptions(background.swatches)}
          value={background.value}
          onChoose={(slot) => quickStyle.setBackground(slot as QuickSwatchValue)}
        />
      ) : null}
      {width ? (
        <QuickRadioRow
          title="Stroke width"
          testId="quick-style-width"
          showTitle={showTitles}
          options={QUICK_WIDTHS.map((w) => ({
            value: w,
            name: WIDTH_NAMES[w],
            content: <BorderStrokeIcon value={w} />,
          }))}
          value={width.value}
          onChoose={quickStyle.setWidth}
        />
      ) : null}
      {style ? (
        <QuickRadioRow
          title="Stroke style"
          testId="quick-style-style"
          showTitle={showTitles}
          options={style.options.map((s) => ({
            value: s,
            name: STYLE_NAMES[s],
            content: s === 'flowing' ? <FlowingLineGlyph /> : <BorderStyleIcon value={s} />,
          }))}
          value={style.value}
          onChoose={quickStyle.setStrokeStyle}
        />
      ) : null}
      {textAlign ? (
        <QuickRadioRow
          title="Text alignment"
          testId="quick-style-text-align"
          showTitle={showTitles}
          options={QUICK_TEXT_ALIGNS.map((a) => ({
            value: a,
            name: TEXT_ALIGN_NAMES[a],
            content: <TextAlignGlyph align={a} />,
          }))}
          value={textAlign.value}
          onChoose={quickStyle.setTextAlign}
        />
      ) : null}
      {iconAlign ? (
        <QuickRadioRow
          title="Icon alignment"
          testId="quick-style-icon-align"
          showTitle={showTitles}
          options={QUICK_ICON_ALIGNS.map((a) => ({
            value: a,
            name: ICON_ALIGN_NAMES[a],
            content: <IconAlignGlyph align={a} />,
          }))}
          value={iconAlign.value}
          onChoose={quickStyle.setIconAlign}
        />
      ) : null}
    </>
  );
}
