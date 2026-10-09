'use client';

// The quick style panel (docs/specs/008-canvas/quick-style-panel.md): the few most-used style choices for
// the selected shapes and arrows, on the left edge of the canvas. The context
// menu stays the complete home of every setting; this is the fast path to a
// handful of them, and never grows into the old Editor panel.

import { useRef, useState, type PointerEvent } from 'react';
import {
  BorderRadiusIcon,
  BorderStrokeIcon,
  BorderStyleIcon,
} from '@/components/palette/palette-style-previews';
import { QUICK_CORNERS } from '@/lib/quick-style-whiteboard';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { useQuickStylePlacement } from '@/hooks/ui/useQuickStylePlacement';
import { useUiScale } from '@/components/providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '@/lib/ui-scale';
import {
  QUICK_ICON_ALIGNS,
  QUICK_TEXT_ALIGNS,
  QUICK_WIDTHS,
  type QuickCorners,
  type QuickIconAlign,
  type QuickStrokeStyle,
  QUICK_INK,
  type QuickColourValue,
  type QuickStyleView,
  type QuickWidth,
} from '@/lib/quick-style';
import type { QuickStyleApi } from '@/hooks/canvas/useQuickStyle';
import {
  isQuickSwatchSlot,
  type QuickSwatchRole,
  type QuickSwatchSlot,
  type TextAlignX,
} from '@livediagram/document';
import type { ShownSwatch } from '@/lib/swatch-overrides';
import { SwatchOverridePopover } from './SwatchOverridePopover';
import { BoardColourRows, QuickPenRows } from './QuickPenRows';
import { QuickHighlighterRows } from './QuickHighlighterRows';
import {
  QUICK_BORDER_PX,
  QUICK_COMPACT_PADDING_PX,
  QUICK_ROW_TARGETS,
  QUICK_TARGET_PX,
} from './quick-style-metrics';
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
// The Corners row (docs/specs/008-canvas/quick-style-panel.md "Corners"), whiteboards only.
const CORNER_NAMES: Record<QuickCorners, string> = {
  none: 'None',
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
};
const ICON_ALIGN_NAMES: Record<QuickIconAlign, string> = {
  left: 'Icon before label',
  above: 'Icon above label',
  right: 'Icon after label',
};

// A colour row's options: the theme's seven swatches, then, on the Stroke and Text colour rows,
// Ink (docs/specs/007-editor/editor-modes.md "One look"), stored by name.
const swatchOptions = (swatches: ShownSwatch[], ink?: string): QuickOption<QuickColourValue>[] => [
  ...swatches.map((s) => ({
    value: s.slot,
    name: s.name,
    content: null,
    swatch: s.color,
    overridden: s.override !== undefined,
  })),
  ...(ink ? [inkOption(ink)] : []),
];
const inkOption = (ink: string): QuickOption<QuickColourValue> => ({
  value: QUICK_INK,
  name: 'Ink',
  content: null,
  swatch: ink,
});

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
  showTitles,
  powerUser = false,
}: {
  quickStyle: QuickStyleApi;
  // Power user mode (docs/specs/007-editor/power-user-mode.md) drops the caption naming the pen
  // or strokes a whiteboard's pen rows style.
  powerUser?: boolean;
  // Zen, embeds, presenting, or a context menu open: the panel stands down.
  hidden: boolean;
  // Section titles; on unless a caller turns them off. The rows keep their
  // names either way.
  showTitles?: boolean;
}) {
  const isMobile = useIsMobileViewport();
  // UI scale (docs/specs/007-editor/ui-scale.md): zoomed at the root, so the
  // placement's screen-px spot is converted to the panel's own px.
  const scale = useUiScale('panels');
  const px = (v: number) => toSurfacePx(v, scale);
  // Section titles stay under Minimal chrome: they are what tells two rows of
  // coloured squares (Stroke, Background) apart at a glance.
  const titles = showTitles ?? true;
  const { view } = quickStyle;
  const active = !hidden && !isMobile && view !== null;
  const panelRef = useRef<HTMLDivElement>(null);
  const spot = useQuickStylePlacement(panelRef, active);
  const [editing, setEditing] = useState<Editing | null>(null);
  // A popover outlives neither the panel nor its swatch.
  const editingGone =
    editing !== null &&
    (!active || !editing.anchor.isConnected || !view?.sections[ROW_OF(editing.role).section]);
  if (editingGone) setEditing(null);
  if (!active) return null;
  const frame = panelFrame();
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
      // A panel, so the panel-opacity preference (docs/specs/007-editor/user-preferences.md) applies to it.
      data-panel-translucent=""
      onPointerDown={stop}
      onDoubleClick={stop}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{
        ...uiScaleStyle(scale),
        width: frame.width,
        padding: frame.padding,
        ...(spot
          ? { left: px(spot.left), top: px(spot.top) }
          : // Measured before paint; hidden until then so it never flashes
            // in the wrong spot.
            { left: 0, top: 0, visibility: 'hidden' as const }),
      }}
      className={`pointer-events-auto fixed z-[var(--z-panel)] flex flex-col rounded-lg border border-slate-200 bg-white shadow-lg shadow-slate-900/5 motion-safe:animate-fade-in dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40 ${frame.className}`}
    >
      <div data-quick-style-body="" className="contents">
        <QuickStyleSections
          view={view}
          quickStyle={quickStyle}
          showTitles={titles}
          showSubject={!powerUser}
          onEditSwatch={(role, slot, anchor) => setEditing({ role, slot, anchor })}
        />
        {view.targetIds.length > 0 ? (
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
        ) : null}
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

// A fixed width, never the content's (docs/specs/008-canvas/quick-style-panel.md "Where it sits"):
// switching between a one-colour and an eight-colour row, or between modes, must not resize the panel, and a swatch row
// never wraps and is never clipped, so the width counts the targets, their gaps, the padding and
// the border exactly. The rows put their targets side by side, touching.
export function panelFrame(): { className: string; width: number; padding: number } {
  const targets = QUICK_ROW_TARGETS;
  const border = 2 * QUICK_BORDER_PX;
  return {
    className: 'gap-2.5',
    width: targets * QUICK_TARGET_PX + 2 * QUICK_COMPACT_PADDING_PX + border,
    padding: QUICK_COMPACT_PADDING_PX,
  };
}

function QuickStyleSections({
  view,
  quickStyle,
  showTitles,
  showSubject,
  onEditSwatch,
}: {
  view: QuickStyleView;
  quickStyle: QuickStyleApi;
  showTitles: boolean;
  showSubject: boolean;
  onEditSwatch: (role: QuickSwatchRole, slot: QuickSwatchSlot, anchor: HTMLButtonElement) => void;
}) {
  // Slot 0 is the way back to the theme and is never overridden.
  // Nor is Ink: it is the same colour on every theme.
  const editFor =
    (role: QuickSwatchRole) => (slot: QuickColourValue, anchor: HTMLButtonElement) => {
      if (isQuickSwatchSlot(slot)) onEditSwatch(role, slot, anchor);
    };
  const { width, style, textAlign, iconAlign, corners } = view.sections;
  // Whose style this is when it is not plainly the selection: the pen in hand,
  // the selected strokes, or a tool's next mark. Power user mode leaves it out.
  const caption = view.caption ?? view.pen?.subject.name ?? view.highlighter?.subject.name;
  return (
    <>
      {showSubject && caption ? (
        <p className="px-0.5 text-xs font-medium text-slate-700 dark:text-slate-200">{caption}</p>
      ) : null}
      {view.pen ? (
        <QuickPenRows pen={view.pen} quickStyle={quickStyle} showTitles={showTitles} />
      ) : null}
      {view.highlighter ? (
        <QuickHighlighterRows
          highlighter={view.highlighter}
          quickStyle={quickStyle}
          showTitles={showTitles}
        />
      ) : null}{' '}
      {COLOUR_ROWS.map((row) => {
        // A whiteboard's Stroke and Text colour rows are the whiteboard's colours.
        const board =
          row.role === 'stroke'
            ? view.sections.boardStroke
            : row.role === 'text'
              ? view.sections.boardText
              : undefined;
        if (board) {
          return (
            <BoardColourRows
              key={row.role}
              title={row.title}
              customTitle={row.role === 'stroke' ? 'Custom stroke colours' : 'Custom text colours'}
              testId={row.testId}
              section={board}
              showTitles={showTitles}
              onChoose={
                row.role === 'stroke' ? quickStyle.setBoardStroke : quickStyle.setBoardTextColour
              }
            />
          );
        }
        const colours = view.sections[row.section];
        return colours ? (
          <QuickRadioRow
            key={row.role}
            title={row.title}
            testId={row.testId}
            showTitle={showTitles}
            options={swatchOptions(colours.swatches, 'ink' in colours ? colours.ink : undefined)}
            columns={QUICK_ROW_TARGETS}
            onOptionContext={editFor(row.role)}
            value={colours.value}
            onChoose={(value) => {
              // Ink is a choice of the Stroke and Text colour rows only.
              if (value !== QUICK_INK) quickStyle[row.set](value);
              else if (row.role === 'stroke') quickStyle.setStroke(value);
              else if (row.role === 'text') quickStyle.setTextColour(value);
            }}
          />
        ) : null;
      })}
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
      {corners ? (
        <QuickRadioRow
          title="Corners"
          testId="quick-style-corners"
          showTitle={showTitles}
          columns={QUICK_CORNERS.length}
          options={QUICK_CORNERS.map((c) => ({
            value: c,
            name: CORNER_NAMES[c],
            content: <BorderRadiusIcon value={c} />,
          }))}
          value={corners.value}
          onChoose={quickStyle.setCorners}
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
