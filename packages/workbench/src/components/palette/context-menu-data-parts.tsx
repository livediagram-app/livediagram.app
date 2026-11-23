// The data-shape context-menu pieces every editor draws the same (docs/specs/009-elements/progress.md): the Data
// category glyph, the no-marker glyph and the percent slider row. Each editor's context-menu-data-rows holds the rest.
import { MenuSliderRow } from '../primitives/MenuSliderRow';
import { MENU_ICON_PX } from './context-menu-icons';
import { Glyph, lucideGlyph } from '@liveworkspace/ui';
import { lucideChartPie } from '@liveworkspace/icons/lucide';

// The "None" tile glyph: a dashed empty circle, sized to match a marker glyph.
export function NoMarkerGlyph() {
  return (
    <Glyph size={18} units={24}>
      <circle cx="12" cy="12" r="8" strokeDasharray="3 3" />
    </Glyph>
  );
}

// Monochrome pie outline: the "Data" category glyph. The other category
// glyphs are all single-colour (currentColor); this matches them.
export const DataMenuGlyph = lucideGlyph(lucideChartPie, MENU_ICON_PX);

// A labelled 0–100 range slider with a right-aligned `{pct}%` readout. Shared
// by the Progress percentage + the Layer opacity rows; each owns its own
// value<->pct conversion and passes the already-resolved pct in.
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
