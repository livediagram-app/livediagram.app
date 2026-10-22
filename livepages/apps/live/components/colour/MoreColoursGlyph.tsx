// "More colours" (docs/specs/004-interface-design/colour-picker.md "Skins"): four of the standard colours (Red,
// Orange, Green, Blue), in their order, as dots in a dashed 20px square. The glyph of every trigger that opens the
// full picker from a quick row (Quick Style's rows, a Sheet's Text and Fill Colour), never a +.
import { standardColours } from '@livediagram/document';

const GLYPH_DOTS = [2, 3, 5, 7].map((i) => standardColours('strong', 'light')[i]!.hex);

export function MoreColoursGlyph() {
  return (
    <span
      aria-hidden
      className="grid h-5 w-5 grid-cols-2 place-items-center rounded-[5px] border border-dashed border-slate-400 p-[3px] dark:border-slate-500"
    >
      {GLYPH_DOTS.map((c) => (
        <span key={c} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} />
      ))}
    </span>
  );
}
