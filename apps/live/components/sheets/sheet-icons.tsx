// The Sheet toolbar's glyphs (blueprint sheet-element.md "Assets and external resources"): vendored Lucide where
// the set has one, else hand-drawn on the same 24-unit grid with the house stroke, `currentColor`.
import { Glyph, Prims } from '@livediagram/ui';
import {
  lucideALargeSmall,
  lucideArrowDownAZ,
  lucideArrowUpZA,
  lucideBetweenHorizontalEnd,
  lucideBetweenHorizontalStart,
  lucideBetweenVerticalEnd,
  lucideBetweenVerticalStart,
  lucideClipboardType,
  lucideEraser,
  lucideEyeOff,
  lucidePaintbrush,
  lucideTableCellsMerge,
  lucideTableCellsSplit,
  lucideTrash2,
  lucideArrowUpDown,
  lucideBaseline,
  lucideChartPie,
  lucideMerge,
  lucideRemoveFormatting,
  lucideTextAlignCenter,
  lucideTextAlignEnd,
  lucideTextAlignStart,
  lucideType,
} from '@livediagram/icons/lucide';

const SIZE = 16;

function G({ children }: { children: React.ReactNode }) {
  return (
    <Glyph size={SIZE} units={24}>
      {children}
    </Glyph>
  );
}

export const MergeIcon = () => (
  <G>
    <Prims prims={lucideMerge} />
  </G>
);
export const SortIcon = () => (
  <G>
    <Prims prims={lucideArrowUpDown} />
  </G>
);
export const TextColourIcon = () => (
  <G>
    <Prims prims={lucideBaseline} />
  </G>
);
export const FontIcon = () => (
  <G>
    <Prims prims={lucideType} />
  </G>
);
export const FontSizeIcon = () => (
  <G>
    <Prims prims={lucideALargeSmall} />
  </G>
);
export const ClearFormatIcon = () => (
  <G>
    <Prims prims={lucideRemoveFormatting} />
  </G>
);

const ALIGN_PRIMS = { l: lucideTextAlignStart, c: lucideTextAlignCenter, r: lucideTextAlignEnd };
export const HAlignIcon = ({ to }: { to: 'l' | 'c' | 'r' }) => (
  <G>
    <Prims prims={ALIGN_PRIMS[to]} />
  </G>
);

export const VAlignIcon = ({ to }: { to: 't' | 'm' | 'b' }) => (
  <G>
    <path d="M4 4h16M4 20h16" opacity={0.45} />
    <path
      d={
        to === 't'
          ? 'M12 8v8M8.5 11.5 12 8l3.5 3.5'
          : to === 'b'
            ? 'M12 16V8M8.5 12.5 12 16l3.5-3.5'
            : 'M8 12h8M12 8v8'
      }
    />
  </G>
);

export const FillColourIcon = () => (
  <G>
    <path d="M5 11 11 5l7 7-6 6Z" />
    <path d="M11 5 9 3M19 15s1.5 2 1.5 3a1.5 1.5 0 0 1-3 0c0-1 1.5-3 1.5-3Z" />
  </G>
);

export const DecimalsIcon = ({ more }: { more: boolean }) => (
  <G>
    <path d="M3 17h.01" strokeWidth={3} />
    <text
      x="6"
      y="17.5"
      fontSize="9"
      fontFamily="system-ui, sans-serif"
      stroke="none"
      fill="currentColor"
    >
      {more ? '.00' : '.0'}
    </text>
    <path d={more ? 'M14 7h7M18 4l3 3-3 3' : 'M21 7h-7M17 4l-3 3 3 3'} />
  </G>
);

export const NumberFormatIcon = () => (
  <G>
    <text
      x="2"
      y="16"
      fontSize="10.5"
      fontWeight="600"
      fontFamily="system-ui, sans-serif"
      stroke="none"
      fill="currentColor"
    >
      123
    </text>
  </G>
);

export const BordersIcon = () => (
  <G>
    <rect x="4" y="4" width="16" height="16" rx="1" />
    <path d="M12 4v16M4 12h16" strokeDasharray="2 2" />
  </G>
);

export const WrapIcon = () => (
  <G>
    <path d="M3 6h18M3 12h15a3 3 0 0 1 0 6h-4M3 18h6" />
    <path d="m16 16-2 2 2 2" />
  </G>
);

export const FreezeIcon = () => (
  <G>
    <rect x="3" y="3" width="18" height="18" rx="1.5" />
    <path d="M3 9h18M9 3v18" strokeWidth={2.4} />
  </G>
);

export const FilterIcon = () => (
  <G>
    <path d="M3 5h18l-7 8v6l-4-2v-4Z" />
  </G>
);

export const SigmaIcon = () => (
  <G>
    <path d="M17 5H7l6 7-6 7h10" />
  </G>
);

// A menu row's tick, for the choice in force (a row's icon slot).
export const CheckMark = ({ on }: { on: boolean }) => (
  <span className="w-4 text-center">{on ? '✓' : ''}</span>
);

export const ChevronIcon = () => (
  <Glyph size={10} units={12}>
    <path d="m3 4.5 3 3 3-3" />
  </Glyph>
);

// Charts (sheet.md "Charts"): Lucide's pie, and a bar and a line drawn to match it.
export const PieChartIcon = () => (
  <G>
    <Prims prims={lucideChartPie} />
  </G>
);
export const BarChartIcon = () => (
  <G>
    <path d="M3 3v18h18" />
    <path d="M8 17v-5M13 17V8M18 17v-8" />
  </G>
);
export const LineChartIcon = () => (
  <G>
    <path d="M3 3v18h18" />
    <path d="m7 15 4-5 3 3 5-6" />
  </G>
);

// The cell menu's rows (docs/specs/029-sheets/sheet.md "Cell menu").
const prims = (p: Parameters<typeof Prims>[0]['prims']) =>
  function CellMenuGlyph() {
    return (
      <G>
        <Prims prims={p} />
      </G>
    );
  };
export const InsertRowAboveIcon = prims(lucideBetweenHorizontalStart);
export const InsertRowBelowIcon = prims(lucideBetweenHorizontalEnd);
export const InsertColumnLeftIcon = prims(lucideBetweenVerticalStart);
export const InsertColumnRightIcon = prims(lucideBetweenVerticalEnd);
export const DeleteIcon = prims(lucideTrash2);
export const ClearContentsIcon = prims(lucideEraser);
export const SortAToZIcon = prims(lucideArrowDownAZ);
export const SortZToAIcon = prims(lucideArrowUpZA);
export const MergeCellsIcon = prims(lucideTableCellsMerge);
export const UnmergeCellsIcon = prims(lucideTableCellsSplit);
export const HideIcon = prims(lucideEyeOff);
export const PasteValuesIcon = prims(lucideClipboardType);
export const FormattingIcon = prims(lucidePaintbrush);
