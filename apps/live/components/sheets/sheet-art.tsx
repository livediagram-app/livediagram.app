// The Sheet's glyph (docs/specs/029-sheets/sheet.md "Placing a sheet"): a small grid with a filled header row and
// one cell ringed, on the 22-unit grid the other Plan glyphs use. Main bundle (the palette draws it).
import { Glyph } from '@livediagram/ui';

export function SheetArt({ size }: { size: number }) {
  return (
    <Glyph size={size} units={22}>
      <rect x="2.5" y="3.5" width="17" height="15" rx="1.5" />
      <path d="M2.5 7.5h17M2.5 11.25h17M2.5 15h17M8 3.5v15M13.75 3.5v15" />
      <rect x="2.5" y="3.5" width="17" height="4" rx="1.5" fill="currentColor" fillOpacity="0.25" />
      <rect x="8" y="11.25" width="5.75" height="3.75" strokeWidth="2.25" />
    </Glyph>
  );
}
