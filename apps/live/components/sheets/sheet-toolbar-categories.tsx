'use client';

// The Sheet toolbar's categories (docs/specs/029-sheets/sheet.md "Toolbar"): the switcher on the toolbar's left picks
// one, and only its buttons show beside it, as the palette's category switcher picks its tiles. Each button acts on
// the whole selection and shows the active cell's state.
import {
  FONT_SIZE_DEFAULT,
  FUNCTION_FAMILIES,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  stepFontSize,
  type CellFormat,
} from '@livediagram/sheets';
import { NumberStepper } from '@/components/primitives/NumberStepper';
import { SheetColourSwatches, SWATCHES_PX } from './SheetColourSwatches';
import { FONT_BUTTON_PX, SheetFontButton } from './SheetFontButton';
import {
  BoldIcon,
  ItalicIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from '@/components/palette/palette-icons';
import type { SheetController } from './sheet-controller';
import type { SheetActions } from './useSheetActions';
import {
  BarChartIcon,
  BordersIcon,
  ClearFormatIcon,
  DecimalsIcon,
  FillColourIcon,
  FilterIcon,
  FontIcon,
  FontSizeIcon,
  FreezeIcon,
  HAlignIcon,
  LineChartIcon,
  MergeIcon,
  NumberFormatIcon,
  PieChartIcon,
  SigmaIcon,
  SortIcon,
  TextColourIcon,
  VAlignIcon,
  WrapIcon,
} from './sheet-icons';
import { type ToolbarMenuKind } from './SheetToolbarMenus';
import { FUNCTION_FAMILY_LABELS } from './SheetFunctionMenu';

export type ToolbarButton = {
  id: string;
  label: string;
  icon: React.ReactNode;
  // A word in place of a glyph (a function's name).
  text?: string;
  pressed?: boolean;
  menu?: ToolbarMenuKind;
  run?: () => void;
  // Drawn in place of a button while it fits (Font Size's − 12 +), `controlPx` wide; folded into More, the `menu`.
  // Given a way to open the button's menu (Text Colour's +).
  control?: (openMenu: (anchor: HTMLElement) => void) => React.ReactNode;
  controlPx?: number;
  // A divider before it, setting a logical group apart (Text Colour, the alignments, Clear Formatting).
  separatorBefore?: boolean;
  // Its glyph alone even when labels fit (Bold, Italic, Underline, Strikethrough: plain enough to need none).
  glyphOnly?: boolean;
};

export type ToolbarCategoryId = 'text' | 'cells' | 'numbers' | 'data' | 'charts' | 'functions';

export type ToolbarCategory = {
  id: ToolbarCategoryId;
  label: string;
  icon: React.ReactNode;
  buttons: ToolbarButton[];
};

export function toolbarCategories(
  c: SheetController,
  actions: SheetActions,
  f: CellFormat | undefined,
): ToolbarCategory[] {
  return [
    {
      id: 'text',
      label: 'Text',
      icon: <TextColourIcon />,
      buttons: [
        {
          id: 'b',
          glyphOnly: true,
          label: 'Bold',
          icon: <BoldIcon />,
          pressed: !!f?.b,
          run: () => actions.toggle('b'),
        },
        {
          id: 'i',
          glyphOnly: true,
          label: 'Italic',
          icon: <ItalicIcon />,
          pressed: !!f?.i,
          run: () => actions.toggle('i'),
        },
        {
          id: 'u',
          glyphOnly: true,
          label: 'Underline',
          icon: <UnderlineIcon />,
          pressed: !!f?.u,
          run: () => actions.toggle('u'),
        },
        {
          id: 'st',
          glyphOnly: true,
          label: 'Strikethrough',
          icon: <StrikethroughIcon />,
          pressed: !!f?.st,
          run: () => actions.toggle('st'),
        },
        {
          id: 'fc',
          label: 'Text Colour',
          icon: <TextColourIcon />,
          menu: 'text-colour',
          separatorBefore: true,
          controlPx: SWATCHES_PX,
          control: (openMenu) => (
            <SheetColourSwatches
              name="Text Colour"
              value={f?.fc}
              onPick={(colour) => actions.format({ fc: colour })}
              onMore={openMenu}
            />
          ),
        },
        {
          // The cell's font, then its size, as one group.
          id: 'ff',
          label: 'Font',
          icon: <FontIcon />,
          menu: 'font',
          separatorBefore: true,
          controlPx: FONT_BUTTON_PX,
          control: (openMenu) => <SheetFontButton font={f?.ff} onOpen={openMenu} />,
        },
        {
          id: 'fs',
          label: 'Font Size',
          icon: <FontSizeIcon />,
          menu: 'font-size',
          controlPx: 112,
          control: () => (
            <NumberStepper
              label="Font Size"
              value={f?.fs ?? FONT_SIZE_DEFAULT}
              min={FONT_SIZE_MIN}
              max={FONT_SIZE_MAX}
              stepBy={stepFontSize}
              onCommit={(fs) => actions.format({ fs: fs === FONT_SIZE_DEFAULT ? null : fs })}
            />
          ),
        },
      ],
    },
    {
      // The cell itself: its fill and borders, where its value sits, then the rarer merge and wrap (menus), then
      // clearing it.
      id: 'cells',
      label: 'Cells',
      icon: <FillColourIcon />,
      buttons: [
        {
          // As Text Colour: the theme's first colours on the toolbar, + for the full picker (folded, the menu).
          id: 'bg',
          label: 'Fill Colour',
          icon: <FillColourIcon />,
          menu: 'fill-colour',
          controlPx: SWATCHES_PX,
          control: (openMenu) => (
            <SheetColourSwatches
              name="Fill Colour"
              value={f?.bg}
              onPick={(colour) => actions.format({ bg: colour })}
              onMore={openMenu}
            />
          ),
        },
        {
          id: 'borders',
          label: 'Borders',
          icon: <BordersIcon />,
          menu: 'borders',
          separatorBefore: true,
        },
        ...(['l', 'c', 'r'] as const).map((ha, k): ToolbarButton => ({
          id: `ha-${ha}`,
          label: `Align ${{ l: 'Left', c: 'Centre', r: 'Right' }[ha]}`,
          icon: <HAlignIcon to={ha} />,
          glyphOnly: true,
          separatorBefore: k === 0,
          pressed: f?.ha === ha,
          // Pressed again, back to automatic (numbers right, text left).
          run: () => actions.format({ ha: f?.ha === ha ? null : ha }),
        })),
        ...(['t', 'm', 'b'] as const).map((va, k): ToolbarButton => ({
          id: `va-${va}`,
          label: `Align ${{ t: 'Top', m: 'Middle', b: 'Bottom' }[va]}`,
          icon: <VAlignIcon to={va} />,
          glyphOnly: true,
          separatorBefore: k === 0,
          pressed: (f?.va ?? 'm') === va,
          run: () => actions.format({ va: va === 'm' ? null : va }),
        })),
        {
          id: 'merge',
          label: 'Merge Cells',
          icon: <MergeIcon />,
          menu: 'merge',
          separatorBefore: true,
        },
        { id: 'wr', label: 'Wrap Text', icon: <WrapIcon />, menu: 'wrap' },
        {
          id: 'clear',
          label: 'Clear Formatting',
          icon: <ClearFormatIcon />,
          separatorBefore: true,
          run: () => actions.clear('formats'),
        },
      ],
    },
    {
      id: 'numbers',
      label: 'Numbers',
      icon: <NumberFormatIcon />,
      buttons: [
        { id: 'nf', label: 'Number Format', icon: <NumberFormatIcon />, menu: 'number' },
        {
          id: 'dp-',
          label: 'Fewer Decimals',
          separatorBefore: true,
          icon: <DecimalsIcon more={false} />,
          run: () => actions.decimals(-1),
        },
        {
          id: 'dp+',
          label: 'More Decimals',
          icon: <DecimalsIcon more />,
          run: () => actions.decimals(1),
        },
      ],
    },
    {
      id: 'data',
      label: 'Data',
      icon: <SortIcon />,
      buttons: [
        { id: 'sort', label: 'Sort', icon: <SortIcon />, menu: 'sort' },
        {
          id: 'filter',
          label: 'Filter',
          icon: <FilterIcon />,
          pressed: !!c.sheet.layout.filter,
          run: () => actions.toggleFilter(),
        },
        {
          id: 'freeze',
          label: 'Freeze',
          icon: <FreezeIcon />,
          menu: 'freeze',
          separatorBefore: true,
        },
      ],
    },
    {
      id: 'charts',
      label: 'Charts',
      icon: <BarChartIcon />,
      buttons: [
        {
          id: 'bar-chart',
          label: 'Bar Chart',
          icon: <BarChartIcon />,
          run: () => actions.insertChart('bar-chart'),
        },
        {
          id: 'line-chart',
          label: 'Line Chart',
          icon: <LineChartIcon />,
          run: () => actions.insertChart('line-chart'),
        },
        {
          id: 'pie-chart',
          label: 'Pie Chart',
          icon: <PieChartIcon />,
          run: () => actions.insertChart('pie-chart'),
        },
      ],
    },
    {
      id: 'functions',
      label: 'Functions',
      icon: <SigmaIcon />,
      buttons: [
        // Every function, family by family: a menu each (SheetFunctionMenu); those that do not fit fold into More.
        ...FUNCTION_FAMILIES.map(([family]): ToolbarButton => ({
          id: `fam-${family}`,
          label: `${FUNCTION_FAMILY_LABELS[family]} Functions`,
          icon: <SigmaIcon />,
          text: FUNCTION_FAMILY_LABELS[family],
          menu: `fn:${family}`,
        })),
        {
          id: 'fn-all',
          label: 'All Functions',
          separatorBefore: true,
          icon: <NumberFormatIcon />,
          text: 'All Functions…',
          run: () => window.open('/help/canvas/plan-mode/sheet-functions/', '_blank', 'noopener'),
        },
      ],
    },
  ];
}
