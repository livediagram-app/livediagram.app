// Small shared context-menu pieces the per-kind sections reuse: the "None" marker glyph, the Data and Rating
// category glyphs, and the labelled percent slider. Split from context-menu-rows.tsx (which re-exports what it
// needs) so that file keeps the generic look-and-feel rows.

import { MenuSliderRow } from '@liveworkspace/workbench/components/primitives/MenuSliderRow';
import { MENU_ICON_PX } from '@/components/palette/context-menu-icons';
import { Glyph, lucideGlyph, Prims } from '@livehuddle/ui';
import { lucideChartPie, lucideStar } from '@liveworkspace/icons/lucide';

// The "None" tile glyph: a dashed empty circle, sized to match a marker glyph.
export function NoMarkerGlyph() {
  return (
    <Glyph size={18} units={24}>
      <circle cx="12" cy="12" r="8" strokeDasharray="3 3" />
    </Glyph>
  );
}

// A filled star category glyph (the hollow star is the Icon category).
export function RatingMenuGlyph() {
  return (
    <Glyph size={MENU_ICON_PX} units={24} fill="currentColor">
      <Prims prims={lucideStar} />
    </Glyph>
  );
}

// Monochrome pie outline: the "Data" category glyph. The other category glyphs are all single-colour
// (currentColor); this matches them.
export const DataMenuGlyph = lucideGlyph(lucideChartPie, MENU_ICON_PX);

// A labelled 0-100 range slider with a right-aligned `{pct}%` readout, shared by the Layer opacity rows; each
// owns its own value<->pct conversion and passes the already-resolved pct in.
export function PercentSliderRow({
  label,
  pct,
  onPct,
}: {
  label: string;
  pct: number;
  onPct: (pct: number) => void;
}) {
  return (
    <MenuSliderRow
      label={label}
      min={0}
      max={100}
      value={pct}
      display={`${pct}%`}
      onChange={onPct}
    />
  );
}
