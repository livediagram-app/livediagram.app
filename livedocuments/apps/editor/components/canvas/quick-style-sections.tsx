'use client';

// The Quick Style bar's rows (docs/specs/008-canvas/quick-style-panel.md "Sections"): each button's short name, its
// value drawn on the button, and the one row of choices its popover holds. The context menu stays the complete home of
// every setting; these are the fast path to a handful of them.

import type { ReactNode } from 'react';

import { BorderStrokeIcon, BorderStyleIcon } from '@/components/palette/palette-style-previews';
import {
  QUICK_ICON_ALIGNS,
  QUICK_TEXT_ALIGNS,
  QUICK_WIDTHS,
  QUICK_INK,
  QUICK_TRANSPARENT,
  type QuickColourValue,
  type QuickIconAlign,
  type QuickStrokeStyle,
  type QuickStyleView,
  type QuickWidth,
} from '@/lib/quick-style';
import type { QuickStyleApi } from '@/hooks/canvas/useQuickStyle';
import {
  isQuickSwatchSlot,
  type QuickSwatchRole,
  type QuickSwatchSlot,
  type TextAlignX,
} from '@livedocuments/document';
import type { ShownSwatch } from '@/lib/swatch-overrides';
import { QuickMoreColours } from './QuickMoreColours';
import { standardGroup } from '@/components/colour/colour-options';
import { useCanvasSurface } from '@liveworkspace/workbench/components/canvas/CanvasSurfaceContext';
import { QUICK_ROW_TARGETS, QUICK_TARGET_PX } from './quick-style-metrics';
import {
  FlowingLineGlyph,
  IconAlignGlyph,
  QuickRadioRow,
  TextAlignGlyph,
  type QuickOption,
} from './quick-style-rows';

export type QuickSectionId = keyof QuickStyleView['sections'];

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

// The bar's buttons, left to right: the section, the button's short name, and its popover's title.
export const QUICK_BAR_SECTIONS: readonly {
  id: QuickSectionId;
  name: string;
  title: string;
  // What it changes, for its row in a phone's Appearance sheet.
  line: string;
}[] = [
  { id: 'stroke', name: 'Stroke', title: 'Stroke', line: 'The outline colour' },
  // Fill, not Background: the page's own Background sits a few buttons along.
  { id: 'background', name: 'Fill', title: 'Fill', line: 'The colour inside' },
  { id: 'textColour', name: 'Text', title: 'Text colour', line: 'The colour of the words' },
  { id: 'width', name: 'Width', title: 'Stroke width', line: 'Thin, medium or thick' },
  { id: 'style', name: 'Line', title: 'Stroke style', line: 'Solid, dashed or dotted' },
  { id: 'textAlign', name: 'Align', title: 'Text alignment', line: 'Left, centre or right' },
  {
    id: 'iconAlign',
    name: 'Icon',
    title: 'Icon alignment',
    line: 'Before, above or after the label',
  },
];

// The colour rows: each one's swatch role, test id and the action a choice runs.
const COLOUR_ROWS = {
  stroke: { role: 'stroke', testId: 'quick-style-stroke', set: 'setStroke' },
  background: { role: 'fill', testId: 'quick-style-background', set: 'setBackground' },
  textColour: { role: 'text', testId: 'quick-style-text-colour', set: 'setTextColour' },
} as const satisfies Partial<
  Record<QuickSectionId, { role: QuickSwatchRole; testId: string; set: keyof QuickStyleApi }>
>;
type ColourSectionId = keyof typeof COLOUR_ROWS;
const isColourSection = (id: QuickSectionId): id is ColourSectionId => id in COLOUR_ROWS;

/** The section a swatch role's row is drawn from. */
export const sectionOfRole = (role: QuickSwatchRole): ColourSectionId =>
  role === 'stroke' ? 'stroke' : role === 'fill' ? 'background' : 'textColour';

/** A section's popover title. */
export const sectionTitle = (id: QuickSectionId): string =>
  QUICK_BAR_SECTIONS.find((s) => s.id === id)!.title;

// A colour row's options: the theme's seven swatches, then, on the Stroke and Text colour rows, Ink
// (docs/specs/008-canvas/quick-style-panel.md "Colours"), stored by name; the Fill row ends in Transparent.
const swatchOptions = (
  swatches: ShownSwatch[],
  ink?: string,
  transparent = false,
): QuickOption<QuickColourValue | typeof QUICK_TRANSPARENT>[] => [
  ...swatches.map((s) => ({
    value: s.slot,
    name: s.name,
    content: null,
    swatch: s.color,
    overridden: s.override !== undefined,
  })),
  ...(ink
    ? [{ value: QUICK_INK as typeof QUICK_INK, name: 'Ink', content: null, swatch: ink }]
    : []),
  ...(transparent
    ? [
        {
          value: QUICK_TRANSPARENT as typeof QUICK_TRANSPARENT,
          name: 'Transparent',
          content: null,
          swatch: 'transparent',
          none: true,
        },
      ]
    : []),
];

// A popover's width: a colour row's targets, touching, or a row of three glyph buttons, inside the popover's padding
// (12 px a side) and border.
const POPOVER_PADDING_PX = 12;
export function sectionPopoverWidth(id: QuickSectionId): number {
  const row = isColourSection(id) ? QUICK_ROW_TARGETS * QUICK_TARGET_PX : 3 * 44 + 2 * 4;
  return row + 2 * POPOVER_PADDING_PX + 2;
}

/** One section's row, titled, for its popover. Right-click, Shift+F10 or the context-menu key on a theme swatch asks
 *  for its custom colour editor (`onEditSwatch`). */
export function QuickSectionRow({
  id,
  view,
  quickStyle,
  showTitle = true,
  onEditSwatch,
}: {
  id: QuickSectionId;
  view: QuickStyleView;
  quickStyle: QuickStyleApi;
  // Off in a phone's sheet, whose heading names the row.
  showTitle?: boolean;
  onEditSwatch: (role: QuickSwatchRole, slot: QuickSwatchSlot, anchor: HTMLButtonElement) => void;
}) {
  const surface = useCanvasSurface();
  const title = sectionTitle(id);
  if (isColourSection(id)) {
    const row = COLOUR_ROWS[id];
    const colours = view.sections[id];
    if (!colours) return null;
    return (
      <QuickRadioRow<QuickColourValue | typeof QUICK_TRANSPARENT>
        title={title}
        testId={row.testId}
        showTitle={showTitle}
        options={swatchOptions(
          colours.swatches,
          'ink' in colours ? colours.ink : undefined,
          row.role === 'fill',
        )}
        columns={QUICK_ROW_TARGETS}
        // Slot 0 is the way back to the theme and is never overridden; nor is Ink (the same on every theme), nor
        // Transparent (no colour to edit).
        onOptionContext={(value, button) => {
          if (value !== QUICK_TRANSPARENT && isQuickSwatchSlot(value))
            onEditSwatch(row.role, value, button);
        }}
        value={colours.value}
        more={
          <QuickMoreColours
            rowTitle={title}
            // The row's pick in force, as the picker names it: a theme swatch's colour, or Ink.
            value={
              colours.value === QUICK_INK
                ? 'ink'
                : (colours.swatches.find((sw) => sw.slot === colours.value)?.color ?? null)
            }
            theme={colours.swatches.map((sw) => ({
              id: sw.color,
              colour: sw.color,
              label: sw.name,
            }))}
            standard={standardGroup(
              row.role === 'fill' ? 'soft' : 'strong',
              surface,
              row.role === 'fill' ? 'hex' : 'name',
            )}
            onPick={(colour) => quickStyle.setColour(row.role, colour)}
          />
        }
        onChoose={(value) => {
          // Transparent is the Fill row's alone; Ink the Stroke and Text colour rows'.
          if (value === QUICK_TRANSPARENT) {
            if (row.role === 'fill') quickStyle.setBackground(QUICK_TRANSPARENT);
          } else if (value !== QUICK_INK) quickStyle[row.set](value);
          else if (row.role === 'stroke') quickStyle.setStroke(value);
          else if (row.role === 'text') quickStyle.setTextColour(value);
        }}
      />
    );
  }
  const { width, style, textAlign, iconAlign } = view.sections;
  if (id === 'width' && width)
    return (
      <QuickRadioRow
        title={title}
        testId="quick-style-width"
        showTitle={showTitle}
        options={QUICK_WIDTHS.map((w) => ({
          value: w,
          name: WIDTH_NAMES[w],
          content: <BorderStrokeIcon value={w} />,
        }))}
        value={width.value}
        onChoose={quickStyle.setWidth}
      />
    );
  if (id === 'style' && style)
    return (
      <QuickRadioRow
        title={title}
        testId="quick-style-style"
        showTitle={showTitle}
        options={style.options.map((s) => ({
          value: s,
          name: STYLE_NAMES[s],
          content: <StyleGlyph value={s} />,
        }))}
        value={style.value}
        onChoose={quickStyle.setStrokeStyle}
      />
    );
  if (id === 'textAlign' && textAlign)
    return (
      <QuickRadioRow
        title={title}
        testId="quick-style-text-align"
        showTitle={showTitle}
        options={QUICK_TEXT_ALIGNS.map((a) => ({
          value: a,
          name: TEXT_ALIGN_NAMES[a],
          content: <TextAlignGlyph align={a} />,
        }))}
        value={textAlign.value}
        onChoose={quickStyle.setTextAlign}
      />
    );
  if (id === 'iconAlign' && iconAlign)
    return (
      <QuickRadioRow
        title={title}
        testId="quick-style-icon-align"
        showTitle={showTitle}
        options={QUICK_ICON_ALIGNS.map((a) => ({
          value: a,
          name: ICON_ALIGN_NAMES[a],
          content: <IconAlignGlyph align={a} />,
        }))}
        value={iconAlign.value}
        onChoose={quickStyle.setIconAlign}
      />
    );
  return null;
}

const StyleGlyph = ({ value }: { value: QuickStrokeStyle }) =>
  value === 'flowing' ? <FlowingLineGlyph /> : <BorderStyleIcon value={value} />;

/** What a section's button shows (docs/specs/008-canvas/quick-style-panel.md "Where it sits"): the colour in force as
 *  a chip, or the glyph of the option in force; a mixed selection draws a split chip, or the first option's glyph
 *  muted. */
export function QuickSectionIcon({ id, view }: { id: QuickSectionId; view: QuickStyleView }) {
  const { sections } = view;
  if (isColourSection(id)) {
    const colours = sections[id];
    const paint = colours?.paint ?? null;
    return <ColourChip kind={id} paint={paint} />;
  }
  const muted = (node: ReactNode, mixed: boolean) => (
    <span
      aria-hidden
      data-mixed={mixed ? '' : undefined}
      className={`flex size-4 items-center justify-center [&>svg]:size-4 ${mixed ? 'opacity-45' : ''}`}
    >
      {node}
    </span>
  );
  if (id === 'width') {
    const v = sections.width?.value ?? null;
    return muted(<BorderStrokeIcon value={v ?? 'medium'} />, v === null);
  }
  if (id === 'style') {
    const v = sections.style?.value ?? null;
    return muted(<StyleGlyph value={v ?? 'solid'} />, v === null);
  }
  if (id === 'textAlign') {
    const v = sections.textAlign?.value ?? null;
    return muted(<TextAlignGlyph align={v ?? 'center'} />, v === null);
  }
  const v = sections.iconAlign?.value ?? null;
  return muted(<IconAlignGlyph align={v ?? 'left'} />, v === null);
}

// A 14 px chip: Stroke an outline in the colour, Fill a filled square, Text an "A" over a bar of it. Transparent is
// the no-colour chip's diagonal; a mixed selection splits the chip in two greys.
const MIXED = 'linear-gradient(135deg, #94a3b8 0 50%, #e2e8f0 50% 100%)';
const NONE =
  'linear-gradient(to top right, transparent calc(50% - 0.75px), #ef4444 calc(50% - 0.75px), #ef4444 calc(50% + 0.75px), transparent calc(50% + 0.75px)), #ffffff';

function ColourChip({ kind, paint }: { kind: ColourSectionId; paint: string | null }) {
  const fill = paint === null ? MIXED : paint === QUICK_TRANSPARENT ? NONE : paint;
  if (kind === 'textColour') {
    return (
      <span
        aria-hidden
        data-chip=""
        data-paint={paint ?? 'mixed'}
        className="flex size-4 flex-col items-center justify-center leading-none"
      >
        <span className="text-[11px] font-bold leading-none">A</span>
        <span
          className="mt-px h-[3px] w-3 rounded-full ring-1 ring-inset ring-black/15 dark:ring-white/25"
          style={{ background: fill }}
        />
      </span>
    );
  }
  if (kind === 'stroke') {
    return (
      <span
        aria-hidden
        data-chip=""
        data-paint={paint ?? 'mixed'}
        className="relative block size-3.5 rounded-[4px]"
      >
        <span className="absolute inset-0 rounded-[4px]" style={{ background: fill }} />
        {/* The page shows through the chip's middle, so it reads as a line, not a fill. */}
        <span className="absolute inset-[3px] rounded-[2px] bg-white ring-1 ring-black/10 dark:bg-slate-900 dark:ring-white/15" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      data-chip=""
      data-paint={paint ?? 'mixed'}
      className="block size-3.5 rounded-[4px] ring-1 ring-inset ring-black/15 dark:ring-white/25"
      style={{ background: fill }}
    />
  );
}
