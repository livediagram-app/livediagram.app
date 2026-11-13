'use client';

// The Quick Style bar's rows (docs/specs/008-canvas/quick-style-panel.md "Sections"): each button's short name, its
// value drawn on the button, and the one row of choices its popover holds. The context menu stays the complete home of
// every setting; these are the fast path to a handful of them.

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
} from '@livedesign/design';
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
import { ColourChip, ValueGlyph } from './quick-style-icons';
import {
  QuickPenColourIcon,
  QuickPenColourRow,
  QuickPenWidthIcon,
  QuickPenWidthRow,
} from './QuickPenRows';
import {
  QuickHighlighterColourIcon,
  QuickHighlighterColourRow,
  QuickHighlighterWidthIcon,
  QuickHighlighterWidthRow,
} from './QuickHighlighterRows';

type ThemeSectionId = keyof QuickStyleView['sections'];
// The marker's and the highlighter's rows, then the theme's.
export type QuickBarSectionId =
  'penColour' | 'penWidth' | 'highlighterColour' | 'highlighterWidth' | ThemeSectionId;

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

// The bar's buttons, left to right: the section, the button's short name, and its popover's title. Each width has its
// own word, so a selection mixing marker strokes, highlights and shapes never shows two buttons of one name.
export const QUICK_BAR_SECTIONS: readonly {
  id: QuickBarSectionId;
  name: string;
  title: string;
  // What it changes, for its row in a phone's Appearance sheet.
  line: string;
}[] = [
  { id: 'penColour', name: 'Marker', title: 'Marker colour', line: "The marker's colour" },
  { id: 'penWidth', name: 'Size', title: 'Marker width', line: "The marker's width" },
  {
    id: 'highlighterColour',
    name: 'Highlighter',
    title: 'Highlighter colour',
    line: "The highlighter's colour",
  },
  {
    id: 'highlighterWidth',
    name: 'Thickness',
    title: 'Highlighter width',
    line: 'Fine, medium or bold',
  },
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

/** Whether the view has the section's row. */
export function sectionShows(id: QuickBarSectionId, view: QuickStyleView): boolean {
  if (id === 'penColour' || id === 'penWidth') return view.pen !== undefined;
  if (id === 'highlighterColour' || id === 'highlighterWidth')
    return view.highlighter !== undefined;
  return view.sections[id] !== undefined;
}

// The theme's colour rows: each one's swatch role, test id and the action a choice runs.
const COLOUR_ROWS = {
  stroke: { role: 'stroke', testId: 'quick-style-stroke', set: 'setStroke' },
  background: { role: 'fill', testId: 'quick-style-background', set: 'setBackground' },
  textColour: { role: 'text', testId: 'quick-style-text-colour', set: 'setTextColour' },
} as const satisfies Partial<
  Record<ThemeSectionId, { role: QuickSwatchRole; testId: string; set: keyof QuickStyleApi }>
>;
type ColourSectionId = keyof typeof COLOUR_ROWS;
const isColourSection = (id: QuickBarSectionId): id is ColourSectionId => id in COLOUR_ROWS;
const CHIP_OF = { stroke: 'stroke', background: 'fill', textColour: 'text' } as const;

/** The section a swatch role's row is drawn from. */
export const sectionOfRole = (role: QuickSwatchRole): ColourSectionId =>
  role === 'stroke' ? 'stroke' : role === 'fill' ? 'background' : 'textColour';

/** A section's popover title. */
export const sectionTitle = (id: QuickBarSectionId): string =>
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

// A popover's width: a colour row's targets, touching (Marker width's six share the same width), or a row of three
// glyph buttons, inside the popover's padding (12 px a side) and border.
const POPOVER_PADDING_PX = 12;
export function sectionPopoverWidth(id: QuickBarSectionId): number {
  const wide = isColourSection(id) || id === 'penColour' || id === 'highlighterColour';
  const row = wide || id === 'penWidth' ? QUICK_ROW_TARGETS * QUICK_TARGET_PX : 3 * 44 + 2 * 4;
  return row + 2 * POPOVER_PADDING_PX + 2;
}

/** One section's row, titled for its popover (untitled in a phone's sheet, which names it). Right-click, Shift+F10 or the context-menu key on a theme swatch asks
 *  for its custom colour editor (`onEditSwatch`). */
export function QuickSectionRow({
  id,
  view,
  quickStyle,
  onEditSwatch,
  showTitle = true,
}: {
  id: QuickBarSectionId;
  view: QuickStyleView;
  quickStyle: QuickStyleApi;
  // Off in a phone's sheet, whose heading names the row.
  showTitle?: boolean;
  onEditSwatch: (role: QuickSwatchRole, slot: QuickSwatchSlot, anchor: HTMLButtonElement) => void;
}) {
  const surface = useCanvasSurface();
  const { pen, highlighter } = view;
  if (id === 'penColour' || id === 'penWidth') {
    if (!pen) return null;
    return id === 'penColour' ? (
      <QuickPenColourRow pen={pen} quickStyle={quickStyle} showTitle={showTitle} />
    ) : (
      <QuickPenWidthRow pen={pen} quickStyle={quickStyle} showTitle={showTitle} />
    );
  }
  if (id === 'highlighterColour' || id === 'highlighterWidth') {
    if (!highlighter) return null;
    return id === 'highlighterColour' ? (
      <QuickHighlighterColourRow
        highlighter={highlighter}
        quickStyle={quickStyle}
        showTitle={showTitle}
      />
    ) : (
      <QuickHighlighterWidthRow
        highlighter={highlighter}
        quickStyle={quickStyle}
        showTitle={showTitle}
      />
    );
  }
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
export function QuickSectionIcon({ id, view }: { id: QuickBarSectionId; view: QuickStyleView }) {
  const { sections, pen, highlighter } = view;
  if (id === 'penColour') return pen ? <QuickPenColourIcon pen={pen} /> : null;
  if (id === 'penWidth') return pen ? <QuickPenWidthIcon pen={pen} /> : null;
  if (id === 'highlighterColour')
    return highlighter ? <QuickHighlighterColourIcon highlighter={highlighter} /> : null;
  if (id === 'highlighterWidth')
    return highlighter ? <QuickHighlighterWidthIcon highlighter={highlighter} /> : null;
  if (isColourSection(id))
    return <ColourChip kind={CHIP_OF[id]} paint={sections[id]?.paint ?? null} />;
  if (id === 'width') {
    const v = sections.width?.value ?? null;
    return (
      <ValueGlyph mixed={v === null}>
        <BorderStrokeIcon value={v ?? 'medium'} />
      </ValueGlyph>
    );
  }
  if (id === 'style') {
    const v = sections.style?.value ?? null;
    return (
      <ValueGlyph mixed={v === null}>
        <StyleGlyph value={v ?? 'solid'} />
      </ValueGlyph>
    );
  }
  if (id === 'textAlign') {
    const v = sections.textAlign?.value ?? null;
    return (
      <ValueGlyph mixed={v === null}>
        <TextAlignGlyph align={v ?? 'center'} />
      </ValueGlyph>
    );
  }
  const v = sections.iconAlign?.value ?? null;
  return (
    <ValueGlyph mixed={v === null}>
      <IconAlignGlyph align={v ?? 'left'} />
    </ValueGlyph>
  );
}
