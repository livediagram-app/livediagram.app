'use client';

// The quick style panel (docs/specs/008-canvas/quick-style-panel.md): the few most-used style choices for
// the selected shapes and arrows, on the right edge of the canvas. The context
// menu stays the complete home of every setting; this is the fast path to a
// handful of them, and never grows into the old Editor panel.

import { useRef, useState, type PointerEvent } from 'react';
import { BorderStrokeIcon, BorderStyleIcon } from '@/components/palette/palette-style-previews';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { useQuickStylePlacement } from '@/hooks/ui/useQuickStylePlacement';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { PanelTitle } from '@/components/primitives/MovablePanelHeader';
import { useMinimalChrome } from '@/components/providers/minimal-chrome';
import type { QuickStyleLayout } from '@/lib/quick-style-placement';
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
import {
  isQuickSwatchSlot,
  type QuickSwatchRole,
  type QuickSwatchSlot,
  type TextAlignX,
} from '@livediagram/diagram';
import type { ShownSwatch } from '@/lib/swatch-overrides';
import { SwatchOverridePopover } from './SwatchOverridePopover';
import {
  ClearStylesGlyph,
  FlowingLineGlyph,
  IconAlignGlyph,
  QuickRadioRow,
  type QuickRowDensity,
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

const swatchOptions = (swatches: ShownSwatch[]): QuickOption<number>[] =>
  swatches.map((s) => ({
    value: s.slot,
    name: s.name,
    content: null,
    swatch: s.color,
    overridden: s.override !== undefined,
  }));

// The swatch whose custom-colour popover is open.
type Editing = { role: QuickSwatchRole; slot: QuickSwatchSlot; anchor: HTMLButtonElement };
// The colour rows, top to bottom: each row's swatch role, the view section it
// is drawn from, its title, and the action a choice runs.
const COLOUR_ROWS = [
  {
    role: 'stroke',
    section: 'stroke',
    title: 'Stroke',
    testId: 'quick-style-stroke',
    set: 'setStroke',
  },
  {
    role: 'fill',
    section: 'background',
    title: 'Background',
    testId: 'quick-style-background',
    set: 'setBackground',
  },
  {
    role: 'text',
    section: 'textColour',
    title: 'Text colour',
    testId: 'quick-style-text-colour',
    set: 'setTextColour',
  },
] as const satisfies readonly {
  role: QuickSwatchRole;
  section: keyof QuickStyleView['sections'];
  title: string;
  testId: string;
  set: keyof QuickStyleApi;
}[];
const ROW_OF = (role: QuickSwatchRole) => COLOUR_ROWS.find((r) => r.role === role)!;

// Pressing inside the panel must never reach the canvas: no marquee, no pan,
// no deselect, no tab menu.
const stop = (e: PointerEvent | React.MouseEvent) => e.stopPropagation();

export function QuickStylePanel({
  quickStyle,
  hidden,
  layout,
  showTitles,
}: {
  quickStyle: QuickStyleApi;
  // Floating docks it under the Palette in the Palette's own panel dress;
  // Toolbar and Minimal keep it compact on the right edge.
  layout: QuickStyleLayout;
  // Zen, embeds, presenting, or a context menu open: the panel stands down.
  hidden: boolean;
  // Section titles; on unless a caller turns them off. The rows keep their
  // names either way.
  showTitles?: boolean;
}) {
  const isMobile = useIsMobileViewport();
  const minimalChrome = useMinimalChrome();
  // Section titles stay under Minimal chrome: they are what tells two rows of
  // coloured squares (Stroke, Background) apart at a glance.
  const titles = showTitles ?? true;
  const { view } = quickStyle;
  const active = !hidden && !isMobile && view !== null;
  const panelRef = useRef<HTMLDivElement>(null);
  const spot = useQuickStylePlacement(panelRef, active, layout);
  const [editing, setEditing] = useState<Editing | null>(null);
  // A popover outlives neither the panel nor its swatch.
  const editingGone =
    editing !== null &&
    (!active || !editing.anchor.isConnected || !view?.sections[ROW_OF(editing.role).section]);
  if (editingGone) setEditing(null);
  if (!active) return null;
  const docked = layout === 'floating';
  const editedSwatch = editing
    ? view.sections[ROW_OF(editing.role).section]?.swatches[editing.slot]
    : undefined;

  return (
    <div
      ref={panelRef}
      role="region"
      aria-label="Quick style"
      data-quick-style-panel=""
      data-testid="quick-style-panel"
      data-layout={layout}
      // A panel in every layout, so the panel-opacity preference
      // (docs/specs/007-editor/user-preferences.md) applies to it as to the Palette.
      data-panel-translucent=""
      onPointerDown={stop}
      onDoubleClick={stop}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={
        spot
          ? {
              left: spot.left,
              top: spot.top,
              ...(spot.width ? { width: spot.width } : {}),
              ...(spot.maxHeight ? { maxHeight: spot.maxHeight } : {}),
            }
          : // Measured before paint; hidden until then so it never flashes
            // in the wrong spot.
            { left: 0, top: 0, visibility: 'hidden' }
      }
      className={`pointer-events-auto fixed z-[var(--z-panel)] flex flex-col rounded-lg border border-slate-200 bg-white shadow-lg shadow-slate-900/5 motion-safe:animate-fade-in dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40 ${docked ? '' : 'w-46 gap-2.5 p-2'}`}
    >
      {docked && !minimalChrome ? (
        // The Palette's header language (MovablePanelHeader), minus the drag
        // and collapse: the panel follows the Palette rather than moving itself.
        // Minimal chrome hides a panel's title and help button, which would
        // leave this header an empty strip, so it goes; the region keeps its
        // name and the section titles stay.
        <div className="flex items-center justify-between gap-2 rounded-t-lg border-b border-slate-200 px-2 pb-1.5 pt-2 dark:border-slate-800">
          <PanelTitle title="Quick style" />
          <HelpArticleLink article="quickStylePanel" />
        </div>
      ) : null}
      <div
        data-quick-style-body=""
        className={
          docked ? 'scrollbar-slim flex min-h-0 flex-col gap-2.5 overflow-y-auto p-2.5' : 'contents'
        }
      >
        <QuickStyleSections
          view={view}
          quickStyle={quickStyle}
          showTitles={titles}
          density={docked ? 'roomy' : 'compact'}
          onEditSwatch={(role, slot, anchor) => setEditing({ role, slot, anchor })}
        />
        <div className="flex flex-col gap-1 border-t border-slate-200 pt-2 dark:border-slate-800">
          {titles ? (
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
      {editing && editedSwatch ? (
        <SwatchOverridePopover
          key={`${editing.role}-${editing.slot}`}
          anchor={editing.anchor}
          label={`Custom colour for ${editedSwatch.override?.themeName ?? editedSwatch.name}, ${ROW_OF(editing.role).title}`}
          colour={editedSwatch.color}
          overridden={editedSwatch.override !== undefined}
          themeNote={`Theme colour: ${editedSwatch.override?.themeName ?? editedSwatch.name}`}
          onSave={(hex) => quickStyle.setSwatchOverride(editing.role, editing.slot, hex)}
          onClear={() => quickStyle.clearSwatchOverride(editing.role, editing.slot)}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function QuickStyleSections({
  view,
  quickStyle,
  showTitles,
  density,
  onEditSwatch,
}: {
  view: QuickStyleView;
  quickStyle: QuickStyleApi;
  showTitles: boolean;
  density: QuickRowDensity;
  onEditSwatch: (role: QuickSwatchRole, slot: QuickSwatchSlot, anchor: HTMLButtonElement) => void;
}) {
  // Slot 0 is the way back to the theme and is never overridden.
  const editFor = (role: QuickSwatchRole) => (slot: number, anchor: HTMLButtonElement) => {
    if (isQuickSwatchSlot(slot)) onEditSwatch(role, slot, anchor);
  };
  const { width, style, textAlign, iconAlign } = view.sections;
  return (
    <>
      {COLOUR_ROWS.map((row) => {
        const colours = view.sections[row.section];
        return colours ? (
          <QuickRadioRow
            key={row.role}
            title={row.title}
            testId={row.testId}
            showTitle={showTitles}
            options={swatchOptions(colours.swatches)}
            density={density}
            onOptionContext={editFor(row.role)}
            value={colours.value}
            onChoose={(slot) => quickStyle[row.set](slot as QuickSwatchValue)}
          />
        ) : null;
      })}
      {width ? (
        <QuickRadioRow
          title="Stroke width"
          testId="quick-style-width"
          showTitle={showTitles}
          density={density}
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
          density={density}
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
          density={density}
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
